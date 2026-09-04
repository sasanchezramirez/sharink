import React, { useState, useEffect, useMemo } from 'react';
import { Activity, LifeArea, ViewportSettings, ViewMode } from './types';
import {
  loadActivities,
  saveActivities,
  loadAreas,
  saveAreas,
  getTodayDateString,
} from './utils/storage';
import { GraphCanvas } from './components/GraphCanvas';
import { TopBar } from './components/TopBar';
import { FloatingDock } from './components/FloatingDock';
import { EditActivityModal } from './components/EditActivityModal';

/**
 * Consolidate activities by name (summing hours, weighted temperature, union of areas)
 */
function aggregateActivities(rawActivities: Activity[]): Activity[] {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      totalHours: number;
      weightedTempSum: number;
      areaIdSet: Set<string>;
      dates: string[];
      notesList: string[];
      createdAt: number;
    }
  >();

  rawActivities.forEach((act) => {
    const key = act.name.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: `agg-${key}`,
        name: act.name.trim(),
        totalHours: act.hours,
        weightedTempSum: act.temperature * act.hours,
        areaIdSet: new Set(act.areaIds),
        dates: [act.date],
        notesList: act.notes ? [`${act.date}: ${act.notes}`] : [],
        createdAt: act.createdAt,
      });
    } else {
      existing.totalHours += act.hours;
      existing.weightedTempSum += act.temperature * act.hours;
      act.areaIds.forEach((aid) => existing.areaIdSet.add(aid));
      if (!existing.dates.includes(act.date)) existing.dates.push(act.date);
      if (act.notes) existing.notesList.push(`${act.date}: ${act.notes}`);
    }
  });

  return Array.from(map.values()).map((item) => ({
    id: item.id,
    name: item.name,
    hours: Math.round(item.totalHours * 10) / 10,
    areaIds: Array.from(item.areaIdSet),
    temperature:
      item.totalHours > 0
        ? Math.round((item.weightedTempSum / item.totalHours) * 10) / 10
        : 0,
    date: item.dates.join(', '),
    notes: item.notesList.length > 0 ? item.notesList.join(' • ') : undefined,
    createdAt: item.createdAt,
  }));
}

export const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activePopover, setActivePopover] = useState<'activity' | 'areas' | 'filters' | null>(null);

  // Viewport Settings
  const [settings, setSettings] = useState<ViewportSettings>({
    viewMode: 'day',
    selectedDate: getTodayDateString(),
    showLabels: true,
    showAreaHulls: false,
    activeAreaFilters: [],
  });

  // Load from local storage
  useEffect(() => {
    setActivities(loadActivities());
    setAreas(loadAreas());
  }, []);

  const handleUpdateActivities = (newActivities: Activity[]) => {
    setActivities(newActivities);
    saveActivities(newActivities);
  };

  const handleUpdateAreas = (newAreas: LifeArea[]) => {
    setAreas(newAreas);
    saveAreas(newAreas);
  };

  // Filter and Aggregate activities based on ViewMode & Date
  const currentFilteredActivities = useMemo(() => {
    if (settings.viewMode === 'global') {
      // Aggregate all activities across all history
      return aggregateActivities(activities);
    }

    if (settings.viewMode === 'day') {
      // Intra-day: show entries for this specific date
      const dayActivities = activities.filter((act) => act.date === settings.selectedDate);
      // Also consolidate within the day if same activity was logged multiple times today
      return aggregateActivities(dayActivities);
    }

    if (settings.viewMode === 'week') {
      // 7-day window surrounding selected date
      const targetTime = new Date(settings.selectedDate).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const weekRawActivities = activities.filter((act) => {
        const actTime = new Date(act.date).getTime();
        const diffDays = (actTime - targetTime) / oneDayMs;
        return diffDays >= -3 && diffDays <= 3;
      });
      // Consolidate across the week into single cumulative nodes!
      return aggregateActivities(weekRawActivities);
    }

    if (settings.viewMode === 'month') {
      const targetMonth = settings.selectedDate.slice(0, 7);
      const monthRawActivities = activities.filter((act) => act.date.startsWith(targetMonth));
      // Consolidate across the month into single cumulative nodes!
      return aggregateActivities(monthRawActivities);
    }

    return activities;
  }, [activities, settings.viewMode, settings.selectedDate]);

  const totalHours = useMemo(() => {
    return currentFilteredActivities.reduce((sum, act) => sum + act.hours, 0);
  }, [currentFilteredActivities]);

  /**
   * Add Activity Handler:
   * If an activity with the same name already exists on that date,
   * it sums the hours to the existing node instead of duplicating!
   */
  const handleAddActivity = (newActData: Omit<Activity, 'id' | 'createdAt'>) => {
    const normName = newActData.name.trim().toLowerCase();
    const targetDate = newActData.date;

    const existingIndex = activities.findIndex(
      (a) => a.date === targetDate && a.name.trim().toLowerCase() === normName
    );

    if (existingIndex !== -1) {
      // Sum to existing activity on this day
      const existing = activities[existingIndex];
      const combinedHours = Math.round((existing.hours + newActData.hours) * 10) / 10;
      const weightedTemp =
        combinedHours > 0
          ? Math.round(
              (((existing.temperature * existing.hours) +
                (newActData.temperature * newActData.hours)) /
                combinedHours) *
                10
            ) / 10
          : newActData.temperature;

      const mergedAreas = Array.from(new Set([...existing.areaIds, ...newActData.areaIds]));
      const mergedNotes = [existing.notes, newActData.notes].filter(Boolean).join(' | ');

      const updatedActivity: Activity = {
        ...existing,
        hours: combinedHours,
        temperature: weightedTemp,
        areaIds: mergedAreas,
        notes: mergedNotes || undefined,
      };

      const updatedList = [...activities];
      updatedList[existingIndex] = updatedActivity;
      handleUpdateActivities(updatedList);
    } else {
      // Create new activity entry for this day
      const newAct: Activity = {
        ...newActData,
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: Date.now(),
      };
      handleUpdateActivities([newAct, ...activities]);
    }
  };

  const handleSaveActivity = (updated: Activity) => {
    // If it's a consolidated activity (starts with 'agg-'), update matching activities by name
    if (updated.id.startsWith('agg-')) {
      const normName = updated.name.trim().toLowerCase();
      handleUpdateActivities(
        activities.map((act) => {
          if (act.name.trim().toLowerCase() === normName) {
            return {
              ...act,
              name: updated.name,
              areaIds: updated.areaIds,
              temperature: updated.temperature,
            };
          }
          return act;
        })
      );
    } else {
      handleUpdateActivities(
        activities.map((act) => (act.id === updated.id ? updated : act))
      );
    }
  };

  const handleDeleteActivity = (id: string) => {
    if (id.startsWith('agg-')) {
      const selected = currentFilteredActivities.find((a) => a.id === id);
      if (selected) {
        const normName = selected.name.trim().toLowerCase();
        handleUpdateActivities(
          activities.filter((act) => act.name.trim().toLowerCase() !== normName)
        );
      }
    } else {
      handleUpdateActivities(activities.filter((act) => act.id !== id));
    }
  };

  const handleAddArea = (name: string, color: string) => {
    const newArea: LifeArea = {
      id: `area-${Date.now()}`,
      name,
      color,
      visible: true,
    };
    handleUpdateAreas([...areas, newArea]);
  };

  const handleToggleAreaVisibility = (areaId: string) => {
    handleUpdateAreas(
      areas.map((a) => (a.id === areaId ? { ...a, visible: !a.visible } : a))
    );
  };

  const handleUpdateSettings = (partial: Partial<ViewportSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0d13] text-gray-200 font-sans">
      {/* Top Header */}
      <TopBar
        viewMode={settings.viewMode}
        onViewModeChange={(mode: ViewMode) => handleUpdateSettings({ viewMode: mode })}
        selectedDate={settings.selectedDate}
        onDateChange={(date: string) => handleUpdateSettings({ selectedDate: date })}
        totalHours={totalHours}
      />

      {/* Main Pure Spatial Canvas */}
      <main className="flex-1 w-full h-[calc(100vh-2.75rem)] relative overflow-hidden">
        <GraphCanvas
          activities={currentFilteredActivities}
          areas={areas}
          settings={settings}
          onSelectActivity={(act) => setSelectedActivity(act)}
          onToggleAreaVisibility={handleToggleAreaVisibility}
          onOpenNewActivity={() => setActivePopover('activity')}
        />

        {/* Minimalist Floating Island Dock */}
        <FloatingDock
          activities={activities}
          areas={areas}
          settings={settings}
          onAddActivity={handleAddActivity}
          onAddArea={handleAddArea}
          onToggleAreaVisibility={handleToggleAreaVisibility}
          onUpdateSettings={handleUpdateSettings}
          activePopover={activePopover}
          setActivePopover={setActivePopover}
        />
      </main>

      {/* Edit Activity Modal */}
      <EditActivityModal
        activity={selectedActivity}
        areas={areas}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        onUpdateActivity={handleSaveActivity}
        onDeleteActivity={handleDeleteActivity}
      />
    </div>
  );
};
