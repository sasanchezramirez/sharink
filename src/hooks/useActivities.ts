import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiClient } from '../api/client';
import {
  ActivityCreate,
  ActivityRead,
  ActivityUpdate,
  ConsolidatedNode,
  TemporalView,
} from '../api/types';
import { Activity } from '../types';

export interface UseActivitiesOptions {
  view: TemporalView;
  date: string;
}

export interface UseActivitiesReturn {
  nodes: ConsolidatedNode[];
  activities: Activity[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createActivity: (payload: ActivityCreate) => Promise<ActivityRead>;
  updateActivity: (id: string, payload: ActivityUpdate) => Promise<ActivityRead>;
  deleteActivity: (id: string) => Promise<void>;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function calculateWeightedTemperature(
  t1: number,
  h1: number,
  t2: number,
  h2: number
): number {
  const sumHours = h1 + h2;
  if (sumHours <= 0) return 0;
  const weighted = (t1 * h1 + t2 * h2) / sumHours;
  return Math.max(-5.0, Math.min(5.0, Math.round(weighted * 100) / 100));
}

function mapNodeToActivity(node: ConsolidatedNode, focalDate: string): Activity {
  return {
    id: node.id || `node-${node.name_normalized}`,
    name: node.name,
    hours: node.total_hours,
    temperature: node.weighted_temperature,
    areaIds: node.area_ids,
    date: focalDate,
    createdAt: Date.now(),
  };
}

/**
 * Remote state hook for activities.
 * Encapsulates fetch + loading/error states, triggers a single request on
 * view/date changes, and provides optimistic updates when creating activities.
 */
export function useActivities({ view, date }: UseActivitiesOptions): UseActivitiesReturn {
  const [nodes, setNodes] = useState<ConsolidatedNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Ref tracking current active request to prevent out-of-order race conditions
  const currentRequestId = useRef(0);

  const fetchActivities = useCallback(
    async (showLoading = true): Promise<void> => {
      const requestId = ++currentRequestId.current;
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const data = await apiClient.listActivities(view, date);
        // Ensure only the latest request updates state
        if (requestId === currentRequestId.current) {
          setNodes(data);
        }
      } catch (err) {
        if (requestId === currentRequestId.current) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);
        }
      } finally {
        if (requestId === currentRequestId.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [view, date]
  );

  // Trigger exactly one request when view or date changes
  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  const createActivity = useCallback(
    async (payload: ActivityCreate): Promise<ActivityRead> => {
      setError(null);
      const previousNodes = nodes;
      const targetNormName = normalizeName(payload.name);

      // Perform optimistic update on nodes
      setNodes((prevNodes) => {
        const existingIndex = prevNodes.findIndex(
          (n) => n.name_normalized === targetNormName
        );

        if (existingIndex !== -1) {
          const existing = prevNodes[existingIndex];
          const newTotalHours = Math.min(
            24.0,
            Math.round((existing.total_hours + payload.hours) * 100) / 100
          );
          const newWeightedTemp = calculateWeightedTemperature(
            existing.weighted_temperature,
            existing.total_hours,
            payload.temperature,
            payload.hours
          );
          const combinedAreaIds = Array.from(
            new Set([...existing.area_ids, ...(payload.area_ids || [])])
          );

          const updatedNode: ConsolidatedNode = {
            ...existing,
            total_hours: newTotalHours,
            weighted_temperature: newWeightedTemp,
            area_ids: combinedAreaIds,
            entry_count: existing.entry_count + 1,
          };

          const nextList = [...prevNodes];
          nextList[existingIndex] = updatedNode;
          return nextList;
        } else {
          const newNode: ConsolidatedNode = {
            name: payload.name.trim(),
            name_normalized: targetNormName,
            total_hours: payload.hours,
            weighted_temperature: payload.temperature,
            area_ids: payload.area_ids || [],
            entry_count: 1,
          };
          return [newNode, ...prevNodes];
        }
      });

      try {
        const created = await apiClient.createActivity(payload);
        // Background refresh to synchronize authoritative server aggregation
        void fetchActivities(false);
        return created;
      } catch (err) {
        // Roll back on failure
        setNodes(previousNodes);
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [nodes, fetchActivities]
  );

  const updateActivity = useCallback(
    async (id: string, payload: ActivityUpdate): Promise<ActivityRead> => {
      setError(null);
      try {
        const matchingNode = nodes.find(
          (n) => n.id === id || `node-${n.name_normalized}` === id
        );
        const targetId = matchingNode?.id || id;
        const updated = await apiClient.updateActivity(targetId, payload);
        await fetchActivities(false);
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [nodes, fetchActivities]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<void> => {
      setError(null);
      try {
        const matchingNode = nodes.find(
          (n) => n.id === id || `node-${n.name_normalized}` === id
        );
        const targetIds = matchingNode?.activity_ids?.length
          ? matchingNode.activity_ids
          : matchingNode?.id
            ? [matchingNode.id]
            : [id];

        await Promise.all(
          targetIds.map((targetId) => apiClient.deleteActivity(targetId))
        );
        await fetchActivities(false);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [nodes, fetchActivities]
  );

  // Compatible Activity array for existing D3 simulation and GraphCanvas
  const activities = useMemo<Activity[]>(() => {
    return nodes.map((node) => mapNodeToActivity(node, date));
  }, [nodes, date]);

  return {
    nodes,
    activities,
    loading,
    error,
    refetch: () => fetchActivities(true),
    createActivity,
    updateActivity,
    deleteActivity,
  };
}
