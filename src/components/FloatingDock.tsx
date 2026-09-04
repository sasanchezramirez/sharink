import React, { useState, useEffect, useMemo } from 'react';
import { Activity, LifeArea, ViewportSettings, TemperatureScore } from '../types';
import { getTemperatureLabel, DEFAULT_AREA_COLORS } from '../utils/colors';
import {
  Plus,
  Layers,
  SlidersHorizontal,
  Eye,
  EyeOff,
  FolderPlus,
  Tag,
  Clock,
  Flame,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';

interface FloatingDockProps {
  activities: Activity[];
  areas: LifeArea[];
  settings: ViewportSettings;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  onAddArea: (name: string, color: string) => void;
  onToggleAreaVisibility: (areaId: string) => void;
  onUpdateSettings: (newSettings: Partial<ViewportSettings>) => void;
  activePopover: 'activity' | 'areas' | 'filters' | null;
  setActivePopover: (val: 'activity' | 'areas' | 'filters' | null) => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  activities,
  areas,
  settings,
  onAddActivity,
  onAddArea,
  onToggleAreaVisibility,
  onUpdateSettings,
  activePopover,
  setActivePopover,
}) => {
  // Activity form state
  const [actName, setActName] = useState('');
  const [actHours, setActHours] = useState('1.0');
  const [actAreaIds, setActAreaIds] = useState<string[]>(areas.length > 0 ? [areas[0].id] : []);
  const [actTemperature, setActTemperature] = useState<TemperatureScore>(3.0);
  const [actNotes, setActNotes] = useState('');

  // Area form state
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaColor, setNewAreaColor] = useState(DEFAULT_AREA_COLORS[0]);

  // Unique list of previous activity names for autocomplete suggestions
  const previousActivityNames = useMemo(() => {
    const names = new Set<string>();
    activities.forEach((a) => {
      if (a.name) names.add(a.name.trim());
    });
    return Array.from(names);
  }, [activities]);

  // Check if an activity with this name already exists on the selected date
  const existingTodayActivity = useMemo(() => {
    if (!actName.trim()) return null;
    const norm = actName.trim().toLowerCase();
    return activities.find(
      (a) => a.date === settings.selectedDate && a.name.trim().toLowerCase() === norm
    );
  }, [activities, actName, settings.selectedDate]);

  // When user types or selects a known activity name, prefill areas and temperature
  const handleNameChange = (val: string) => {
    setActName(val);
    const norm = val.trim().toLowerCase();
    const match = activities.find((a) => a.name.trim().toLowerCase() === norm);
    if (match) {
      if (match.areaIds && match.areaIds.length > 0) setActAreaIds(match.areaIds);
      setActTemperature(match.temperature);
    }
  };

  // Keyboard shortcut listener (N: new activity, Esc: close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') setActivePopover(null);
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setActivePopover(activePopover === 'activity' ? null : 'activity');
      } else if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePopover, setActivePopover]);

  // Create / Accumulate Activity Submit
  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actName.trim()) return;

    onAddActivity({
      name: actName.trim(),
      hours: Math.max(0.1, parseFloat(actHours) || 1),
      areaIds: actAreaIds.length > 0 ? actAreaIds : [areas[0]?.id || 'default'],
      temperature: actTemperature,
      date: settings.selectedDate,
      notes: actNotes.trim() || undefined,
    });

    setActName('');
    setActHours('1.0');
    setActNotes('');
    setActivePopover(null);
  };

  const toggleAreaForActivity = (areaId: string) => {
    setActAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  // Create Area Submit
  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    onAddArea(newAreaName.trim(), newAreaColor);
    setNewAreaName('');
    const nextIdx = (DEFAULT_AREA_COLORS.indexOf(newAreaColor) + 1) % DEFAULT_AREA_COLORS.length;
    setNewAreaColor(DEFAULT_AREA_COLORS[nextIdx]);
  };

  const togglePopover = (type: 'activity' | 'areas' | 'filters') => {
    setActivePopover(activePopover === type ? null : type);
  };

  return (
    <>
      {/* FLOATING POPOVER CONTENT WINDOW */}
      {activePopover && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-sm sm:max-w-md z-40 p-5 rounded-2xl shadow-2xl backdrop-blur-2xl bg-[#101218]/95 border border-white/10 text-gray-200 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-100">
                {activePopover === 'activity' && 'Registrar / Sumar Actividad'}
                {activePopover === 'areas' && 'Aspectos de Vida'}
                {activePopover === 'filters' && 'Herramientas de Vista'}
              </h3>
            </div>
            <button
              onClick={() => setActivePopover(null)}
              className="p-1 rounded-lg text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* TAB: NUEVA ACTIVIDAD */}
          {activePopover === 'activity' && (
            <form onSubmit={handleCreateActivity} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-gray-400">
                  <Tag size={12} />
                  Nombre de la Actividad
                </label>
                <input
                  type="text"
                  list="activity-suggestions-list"
                  value={actName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Cocina & Nutrición, Deep Work..."
                  autoFocus
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#08090d] border border-white/10 text-white outline-none focus:border-sky-500 transition-colors"
                />
                <datalist id="activity-suggestions-list">
                  {previousActivityNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                {/* Real-time Accumulation Feedback */}
                {existingTodayActivity && (
                  <div className="mt-2 p-2 rounded-lg bg-sky-950/40 border border-sky-500/30 flex items-center gap-2 text-[11px] text-sky-300 animate-fadeIn">
                    <Zap size={13} className="shrink-0 text-sky-400" />
                    <span>
                      Esta actividad ya existe hoy ({existingTodayActivity.hours}h). Se sumarán{' '}
                      <strong>{actHours}h</strong> para un total de{' '}
                      <strong>
                        {(existingTodayActivity.hours + (parseFloat(actHours) || 0)).toFixed(1)}h
                      </strong>{' '}
                      en su nodo.
                    </span>
                  </div>
                )}
              </div>

              {/* Hours */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                    <Clock size={12} />
                    Horas a Añadir
                  </span>
                  <span className="font-mono font-bold text-sky-400">{actHours}h</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.25"
                    max="12"
                    step="0.25"
                    value={actHours}
                    onChange={(e) => setActHours(e.target.value)}
                    className="w-full h-1.5 rounded-lg cursor-pointer accent-sky-500 bg-[#08090d]"
                  />
                  <input
                    type="number"
                    min="0.1"
                    max="24"
                    step="0.5"
                    value={actHours}
                    onChange={(e) => setActHours(e.target.value)}
                    className="w-14 px-1.5 py-1 rounded-lg text-xs font-mono text-center bg-[#08090d] border border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Multi-area selector */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center justify-between text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Layers size={12} />
                    Aspectos Asociados
                  </span>
                  <span className="text-[10px] text-gray-500">Atracción espacial</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {areas.map((area) => {
                    const isSelected = actAreaIds.includes(area.id);
                    return (
                      <button
                        type="button"
                        key={area.id}
                        onClick={() => toggleAreaForActivity(area.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                          isSelected
                            ? 'bg-[#181b24] border-sky-500/80 text-white font-medium shadow-sm'
                            : 'bg-[#08090d]/60 border-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                        <span>{area.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temperature Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                  <span className="font-medium uppercase tracking-wider flex items-center gap-1.5 text-gray-400">
                    <Flame size={12} />
                    Impacto Vital (EM)
                  </span>
                  <span className={`font-semibold ${getTemperatureLabel(actTemperature).textClass}`}>
                    {actTemperature > 0 ? `+${actTemperature.toFixed(1)}` : actTemperature.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={actTemperature}
                  onChange={(e) => setActTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-red-500 via-yellow-400 via-emerald-500 to-sky-500"
                />
                <div className="flex justify-between text-[10px] mt-1 text-gray-400">
                  <span className="text-red-400">-5 Rojo</span>
                  <span className="text-yellow-400">0 Amarillo</span>
                  <span className="text-sky-400">+5 Azul</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all active:scale-98"
              >
                <Sparkles size={14} />
                <span>{existingTodayActivity ? 'Sumar al Nodo de Hoy' : 'Agregar al Espacio'}</span>
              </button>
            </form>
          )}

          {/* TAB: ASPECTOS */}
          {activePopover === 'areas' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateArea} className="space-y-2 p-3 rounded-xl border border-white/5 bg-[#08090d]">
                <div className="text-[11px] font-medium flex items-center gap-1.5 text-gray-400">
                  <FolderPlus size={12} />
                  <span>Nuevo Aspecto de Vida</span>
                </div>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Ej. Espiritualidad, Finanzas..."
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#101218] border border-white/10 text-white outline-none focus:border-sky-500"
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {DEFAULT_AREA_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewAreaColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          newAreaColor === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    Crear
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {areas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-2 rounded-lg text-xs border border-white/5 bg-[#141620]/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
                      <span className={area.visible ? 'text-gray-200' : 'text-gray-500 line-through'}>
                        {area.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onToggleAreaVisibility(area.id)}
                      className="p-1 rounded text-gray-400 hover:text-white"
                    >
                      {area.visible ? <Eye size={13} className="text-sky-400" /> : <EyeOff size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: FILTROS & VISTA */}
          {activePopover === 'filters' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#08090d] cursor-pointer hover:bg-white/5">
                <span className="text-xs text-gray-300">Etiquetas de texto en nodos</span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ showLabels: e.target.checked })}
                  className="accent-sky-500 cursor-pointer"
                />
              </label>

              <div className="pt-2">
                <span className="block text-[11px] uppercase tracking-wider mb-2 font-medium text-gray-500">
                  Aislar Aspectos Espaciales
                </span>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {areas.map((area) => {
                    const isFiltered =
                      settings.activeAreaFilters.length === 0 ||
                      settings.activeAreaFilters.includes(area.id);
                    return (
                      <label
                        key={area.id}
                        className="flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                          <span className={isFiltered ? 'text-gray-300' : 'text-gray-600'}>
                            {area.name}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isFiltered}
                          onChange={() => {
                            const current = settings.activeAreaFilters;
                            let next: string[];
                            if (current.length === 0) {
                              next = areas.map((a) => a.id).filter((id) => id !== area.id);
                            } else if (current.includes(area.id)) {
                              next = current.filter((id) => id !== area.id);
                            } else {
                              next = [...current, area.id];
                              if (next.length === areas.length) next = [];
                            }
                            onUpdateSettings({ activeAreaFilters: next });
                          }}
                          className="accent-sky-500 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLOATING DOCK PILL */}
      <nav
        aria-label="Herramientas"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 h-11 px-2 rounded-full flex items-center gap-1 z-30 shadow-2xl backdrop-blur-2xl bg-[#101218]/90 border border-white/10"
      >
        {/* + Actividad Action */}
        <button
          onClick={() => togglePopover('activity')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
            activePopover === 'activity'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-[#181b24] text-gray-200 hover:text-white'
          }`}
        >
          <Plus size={14} />
          <span>Actividad</span>
          <span className="text-[9px] opacity-60 font-mono hidden sm:inline">N</span>
        </button>

        {/* Aspectos Action */}
        <button
          onClick={() => togglePopover('areas')}
          title="Aspectos de Vida"
          className={`p-2 rounded-full transition-colors ${
            activePopover === 'areas' ? 'text-sky-400 bg-sky-500/10' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers size={15} />
        </button>

        {/* Filtros Action */}
        <button
          onClick={() => togglePopover('filters')}
          title="Filtros y Visibilidad"
          className={`p-2 rounded-full transition-colors ${
            activePopover === 'filters' ? 'text-sky-400 bg-sky-500/10' : 'text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal size={15} />
        </button>
      </nav>
    </>
  );
};
