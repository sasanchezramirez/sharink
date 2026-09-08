import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../api/client';
import { AreaCreate, AreaRead, AreaUpdate } from '../api/types';
import { LifeArea } from '../types';

export interface UseAreasReturn {
  areas: AreaRead[];
  lifeAreas: LifeArea[];
  loading: boolean;
  error: Error | null;
  fetchAreas: () => Promise<void>;
  createArea: (payload: AreaCreate) => Promise<AreaRead>;
  updateArea: (id: string, payload: AreaUpdate) => Promise<AreaRead>;
  deleteArea: (id: string) => Promise<void>;
  toggleAreaVisibility: (id: string) => Promise<void>;
}

/**
 * Remote state management hook for Life Areas.
 * Fetches areas on mount, provides loading and error states,
 * and supports optimistic mutations with automatic rollback.
 */
export function useAreas(): UseAreasReturn {
  const [areas, setAreas] = useState<AreaRead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listAreas();
      setAreas(data);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const createArea = useCallback(
    async (payload: AreaCreate): Promise<AreaRead> => {
      setError(null);
      // Optimistic temporary area
      const tempId = `temp-area-${Date.now()}`;
      const optimisticArea: AreaRead = {
        id: tempId,
        user_id: apiClient.getUserId(),
        name: payload.name.trim(),
        color: payload.color,
        visible: payload.visible ?? true,
        created_at: new Date().toISOString(),
      };
      setAreas((prev) => [...prev, optimisticArea]);

      try {
        const created = await apiClient.createArea(payload);
        // Replace temporary entry with server response
        setAreas((prev) => prev.map((a) => (a.id === tempId ? created : a)));
        return created;
      } catch (err) {
        // Roll back
        setAreas((prev) => prev.filter((a) => a.id !== tempId));
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    []
  );

  const updateArea = useCallback(
    async (id: string, payload: AreaUpdate): Promise<AreaRead> => {
      setError(null);
      const previousAreas = areas;
      // Optimistic update
      setAreas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...payload } : a))
      );

      try {
        const updated = await apiClient.updateArea(id, payload);
        setAreas((prev) => prev.map((a) => (a.id === id ? updated : a)));
        return updated;
      } catch (err) {
        // Roll back
        setAreas(previousAreas);
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [areas]
  );

  const deleteArea = useCallback(
    async (id: string): Promise<void> => {
      setError(null);
      const previousAreas = areas;
      // Optimistic delete
      setAreas((prev) => prev.filter((a) => a.id !== id));

      try {
        await apiClient.deleteArea(id);
      } catch (err) {
        // Roll back
        setAreas(previousAreas);
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [areas]
  );

  const toggleAreaVisibility = useCallback(
    async (id: string): Promise<void> => {
      const target = areas.find((a) => a.id === id);
      if (!target) return;
      await updateArea(id, { visible: !target.visible });
    },
    [areas, updateArea]
  );

  // Compatible LifeArea mapping for graph renderers
  const lifeAreas = useMemo<LifeArea[]>(
    () =>
      areas.map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        visible: a.visible,
      })),
    [areas]
  );

  return {
    areas,
    lifeAreas,
    loading,
    error,
    fetchAreas,
    createArea,
    updateArea,
    deleteArea,
    toggleAreaVisibility,
  };
}
