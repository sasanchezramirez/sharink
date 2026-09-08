import React, { useState, useMemo } from 'react';
import { Activity, ViewportSettings, ViewMode } from './types';
import { getTodayDateString } from './utils/storage';
import { useActivities, useAreas } from './hooks';
import { GraphCanvas } from './components/GraphCanvas';
import { TopBar } from './components/TopBar';
import { FloatingDock } from './components/FloatingDock';
import { EditActivityModal } from './components/EditActivityModal';

export const App: React.FC = () => {
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

  // Remote data hooks (Phase 4 integration)
  const {
    lifeAreas: areas,
    loading: areasLoading,
    error: areasError,
    fetchAreas,
    createArea,
    toggleAreaVisibility,
  } = useAreas();

  const {
    nodes,
    activities,
    loading: activitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
    createActivity,
    updateActivity,
    deleteActivity,
  } = useActivities({
    view: settings.viewMode,
    date: settings.selectedDate,
  });

  const isLoading = areasLoading || activitiesLoading;
  const currentError = activitiesError || areasError;

  const handleRetry = () => {
    void fetchAreas();
    void refetchActivities();
  };

  // Total accumulated hours in the focal period calculated from consolidated nodes
  const totalHours = useMemo(() => {
    const sum = nodes.reduce((acc, node) => acc + node.total_hours, 0);
    return Math.round(sum * 10) / 10;
  }, [nodes]);

  /**
   * Add Activity Handler:
   * Delegated to backend API with optimistic UI updates handled inside useActivities.
   */
  const handleAddActivity = async (newActData: Omit<Activity, 'id' | 'createdAt'>) => {
    try {
      await createActivity({
        name: newActData.name,
        hours: newActData.hours,
        temperature: newActData.temperature,
        date: newActData.date,
        notes: newActData.notes,
        area_ids: newActData.areaIds,
      });
    } catch (err) {
      console.error('Failed to create activity:', err);
    }
  };

  /**
   * Update Activity Handler:
   * Saves changes to backend by activity ID and refreshes view.
   */
  const handleSaveActivity = async (updated: Activity) => {
    try {
      await updateActivity(updated.id, {
        name: updated.name,
        hours: updated.hours,
        temperature: updated.temperature,
        date: updated.date,
        notes: updated.notes,
        area_ids: updated.areaIds,
      });
    } catch (err) {
      console.error('Failed to update activity:', err);
    }
  };

  /**
   * Delete Activity Handler:
   * Removes activity from database and refreshes view.
   */
  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteActivity(id);
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  /**
   * Add Life Area Handler:
   * Creates new life area on backend.
   */
  const handleAddArea = async (name: string, color: string) => {
    try {
      await createArea({ name, color, visible: true });
    } catch (err) {
      console.error('Failed to create area:', err);
    }
  };

  const handleToggleAreaVisibility = (areaId: string) => {
    void toggleAreaVisibility(areaId);
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
        loading={isLoading}
        error={currentError}
        onRetry={handleRetry}
      />

      {/* Main Pure Spatial Canvas */}
      <main className="flex-1 w-full h-[calc(100vh-2.75rem)] relative overflow-hidden">
        <GraphCanvas
          activities={activities}
          areas={areas}
          settings={settings}
          loading={isLoading}
          error={currentError}
          onRetry={handleRetry}
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
