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
import { Toolbar } from './components/Toolbar';
import { EditActivityModal } from './components/EditActivityModal';

export const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Viewport Settings
  const [settings, setSettings] = useState<ViewportSettings>({
    viewMode: 'day',
    selectedDate: getTodayDateString(),
    showLabels: true,
    showAreaHulls: true,
    activeAreaFilters: [],
  });

  // Load from local storage on mount
  useEffect(() => {
    setActivities(loadActivities());
    setAreas(loadAreas());
  }, []);

  // Persist activities whenever changed
  const handleUpdateActivities = (newActivities: Activity[]) => {
    setActivities(newActivities);
    saveActivities(newActivities);
  };

  // Persist areas whenever changed
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
      // 7-day window surrounding or ending at selected date
      const targetTime = new Date(settings.selectedDate).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      return activities.filter((act) => {
        const actTime = new Date(act.date).getTime();
        const diffDays = (actTime - targetTime) / oneDayMs;
        return diffDays >= -3 && diffDays <= 3;
      });
    }

    if (settings.viewMode === 'month') {
      const targetMonth = settings.selectedDate.slice(0, 7); // YYYY-MM
      return activities.filter((act) => act.date.startsWith(targetMonth));
    }

    return activities;
  }, [activities, settings.viewMode, settings.selectedDate]);

  // Total hours in current view
  const totalHours = useMemo(() => {
    return currentFilteredActivities.reduce((sum, act) => sum + act.hours, 0);
  }, [currentFilteredActivities]);

  // Create Activity handler
  const handleAddActivity = (newActData: Omit<Activity, 'id' | 'createdAt'>) => {
    const newAct: Activity = {
      ...newActData,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: Date.now(),
    };
    handleUpdateActivities([newAct, ...activities]);
  };

  // Update Activity handler
  const handleSaveActivity = (updated: Activity) => {
    handleUpdateActivities(
      activities.map((act) => (act.id === updated.id ? updated : act))
    );
  };

  // Delete Activity handler
  const handleDeleteActivity = (id: string) => {
    handleUpdateActivities(activities.filter((act) => act.id !== id));
  };

  // Add Area handler
  const handleAddArea = (name: string, color: string) => {
    const newArea: LifeArea = {
      id: `area-${Date.now()}`,
      name,
      color,
      visible: true,
    };
    handleUpdateAreas([...areas, newArea]);
  };

  // Toggle Area Visibility
  const handleToggleAreaVisibility = (areaId: string) => {
    handleUpdateAreas(
      areas.map((a) => (a.id === areaId ? { ...a, visible: !a.visible } : a))
    );
  };

  // Update Settings
  const handleUpdateSettings = (partial: Partial<ViewportSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0d13]">
      {/* Top Header Bar */}
      <TopBar
        viewMode={settings.viewMode}
        onViewModeChange={(mode: ViewMode) => handleUpdateSettings({ viewMode: mode })}
        selectedDate={settings.selectedDate}
        onDateChange={(date: string) => handleUpdateSettings({ selectedDate: date })}
        totalHours={totalHours}
        onToggleToolbar={() => setIsToolbarOpen((prev) => !prev)}
        isToolbarOpen={isToolbarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Dynamic Graph Canvas */}
        <main className="flex-1 h-full relative">
          <GraphCanvas
            activities={currentFilteredActivities}
            areas={areas}
            settings={settings}
            onSelectActivity={(act) => setSelectedActivity(act)}
            onUpdateAreaVisibility={handleToggleAreaVisibility}
          />
        </main>

        {/* Lateral Toolbar / Simulator (CA6, CA7) */}
        <Toolbar
          areas={areas}
          settings={settings}
          isOpen={isToolbarOpen}
          onClose={() => setIsToolbarOpen(false)}
          onAddActivity={handleAddActivity}
          onAddArea={handleAddArea}
          onToggleAreaVisibility={handleToggleAreaVisibility}
          onUpdateSettings={handleUpdateSettings}
        />
      </div>

      {/* Edit / Inspect Modal (A6) */}
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
