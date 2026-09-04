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
    showAreaHulls: false, // Hulls removed in V2
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

  // Filter activities based on ViewMode & Date
  const currentFilteredActivities = useMemo(() => {
    if (settings.viewMode === 'global') {
      return activities;
    }

    if (settings.viewMode === 'day') {
      return activities.filter((act) => act.date === settings.selectedDate);
    }

    if (settings.viewMode === 'week') {
      const targetTime = new Date(settings.selectedDate).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      return activities.filter((act) => {
        const actTime = new Date(act.date).getTime();
        const diffDays = (actTime - targetTime) / oneDayMs;
        return diffDays >= -3 && diffDays <= 3;
      });
    }

    if (settings.viewMode === 'month') {
      const targetMonth = settings.selectedDate.slice(0, 7);
      return activities.filter((act) => act.date.startsWith(targetMonth));
    }

    return activities;
  }, [activities, settings.viewMode, settings.selectedDate]);

  const totalHours = useMemo(() => {
    return currentFilteredActivities.reduce((sum, act) => sum + act.hours, 0);
  }, [currentFilteredActivities]);

  const handleAddActivity = (newActData: Omit<Activity, 'id' | 'createdAt'>) => {
    const newAct: Activity = {
      ...newActData,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: Date.now(),
    };
    handleUpdateActivities([newAct, ...activities]);
  };

  const handleSaveActivity = (updated: Activity) => {
    handleUpdateActivities(
      activities.map((act) => (act.id === updated.id ? updated : act))
    );
  };

  const handleDeleteActivity = (id: string) => {
    handleUpdateActivities(activities.filter((act) => act.id !== id));
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#08090d] text-gray-200 font-sans">
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
