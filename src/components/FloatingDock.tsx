import React, { useState, useEffect } from 'react';
import { Activity, LifeArea, ViewportSettings, TemperatureScore } from '../types';
import { getTemperatureLabel, DEFAULT_AREA_COLORS } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import {
  Plus,
  Layers,
  SlidersHorizontal,
  Palette,
  Eye,
  EyeOff,
  FolderPlus,
  Tag,
  Clock,
  Flame,
  X,
  Sparkles,
} from 'lucide-react';

interface FloatingDockProps {
  areas: LifeArea[];
  settings: ViewportSettings;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  onAddArea: (name: string, color: string) => void;
  onToggleAreaVisibility: (areaId: string) => void;
  onUpdateSettings: (newSettings: Partial<ViewportSettings>) => void;
  activePopover: 'activity' | 'areas' | 'filters' | 'themes' | null;
  setActivePopover: (val: 'activity' | 'areas' | 'filters' | 'themes' | null) => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  areas,
  settings,
  onAddActivity,
  onAddArea,
  onToggleAreaVisibility,
  onUpdateSettings,
  activePopover,
  setActivePopover,
}) => {
  const { theme, themeConfig, setTheme, cycleTheme } = useTheme();

  // Activity form state
  const [actName, setActName] = useState('');
  const [actHours, setActHours] = useState('2.0');
  const [actAreaIds, setActAreaIds] = useState<string[]>(areas.length > 0 ? [areas[0].id] : []);
  const [actTemperature, setActTemperature] = useState<TemperatureScore>(3.0);
  const [actNotes, setActNotes] = useState('');

  // Area form state
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaColor, setNewAreaColor] = useState(DEFAULT_AREA_COLORS[0]);

  // Keyboard shortcut listener (N: new activity, T: cycle theme, Esc: close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') setActivePopover(null);
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setActivePopover(activePopover === 'activity' ? null : 'activity');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        cycleTheme();
      } else if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePopover, cycleTheme, setActivePopover]);

  // Create Activity Submit
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
    setActHours('2.0');
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

  const togglePopover = (type: 'activity' | 'areas' | 'filters' | 'themes') => {
    setActivePopover(activePopover === type ? null : type);
  };

  return (
    <>
      {/* FLOATING POPOVER CONTENT WINDOW */}
      {activePopover && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-sm sm:max-w-md z-40 p-5 rounded-2xl shadow-2xl backdrop-blur-2xl border animate-fadeIn"
          style={{
            backgroundColor: `${themeConfig.bgSurface}f5`,
            borderColor: themeConfig.borderStrong,
            color: themeConfig.textPrimary,
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: themeConfig.borderSubtle }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeConfig.accent }} />
              <h3 className="font-semibold text-xs uppercase tracking-wider">
                {activePopover === 'activity' && 'Registrar Nueva Actividad'}
                {activePopover === 'areas' && 'Aspectos de Vida'}
                {activePopover === 'filters' && 'Herramientas de Vista'}
                {activePopover === 'themes' && 'Paleta y Tema Visual'}
              </h3>
            </div>
            <button
              onClick={() => setActivePopover(null)}
              className="p-1 rounded-lg hover:opacity-75 transition-opacity"
              style={{ color: themeConfig.textMuted }}
            >
              <X size={16} />
            </button>
          </div>

          {/* TAB: NUEVA ACTIVIDAD */}
          {activePopover === 'activity' && (
            <form onSubmit={handleCreateActivity} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
                  <Tag size={12} />
                  Nombre de la Actividad
                </label>
                <input
                  type="text"
                  value={actName}
                  onChange={(e) => setActName(e.target.value)}
                  placeholder="Ej. Sesión de Deep Work, Calistenia..."
                  autoFocus
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-colors border"
                  style={{
                    backgroundColor: themeConfig.bgCanvas,
                    borderColor: themeConfig.borderSubtle,
                    color: themeConfig.textPrimary,
                  }}
                />
              </div>

              {/* Hours */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[11px]" style={{ color: themeConfig.textSecondary }}>
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                    <Clock size={12} />
                    Horas Invertidas
                  </span>
                  <span className="font-mono font-bold" style={{ color: themeConfig.accent }}>
                    {actHours}h
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.25"
                    max="12"
                    step="0.25"
                    value={actHours}
                    onChange={(e) => setActHours(e.target.value)}
                    className="w-full h-1.5 rounded-lg cursor-pointer accent-current"
                    style={{ color: themeConfig.accent, backgroundColor: themeConfig.bgCanvas }}
                  />
                  <input
                    type="number"
                    min="0.1"
                    max="24"
                    step="0.5"
                    value={actHours}
                    onChange={(e) => setActHours(e.target.value)}
                    className="w-14 px-1.5 py-1 rounded-lg text-xs font-mono text-center border"
                    style={{
                      backgroundColor: themeConfig.bgCanvas,
                      borderColor: themeConfig.borderSubtle,
                      color: themeConfig.textPrimary,
                    }}
                  />
                </div>
              </div>

              {/* Multi-area selector */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center justify-between" style={{ color: themeConfig.textSecondary }}>
                  <span className="flex items-center gap-1.5">
                    <Layers size={12} />
                    Aspectos Asociados
                  </span>
                  <span className="text-[10px] opacity-60">Intersección múltiple</span>
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
                          isSelected ? 'font-medium shadow-sm' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${themeConfig.bgElevated}` : 'transparent',
                          borderColor: isSelected ? area.color : themeConfig.borderSubtle,
                          color: isSelected ? themeConfig.textPrimary : themeConfig.textSecondary,
                        }}
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
                  <span className="font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
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
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-rose-500 via-slate-400 to-indigo-500"
                />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: themeConfig.textMuted }}>
                  <span>-5 Rojo (Drenante)</span>
                  <span>0 Neutro</span>
                  <span>+5 Azul (Flujo)</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90 active:scale-98"
                style={{
                  backgroundColor: themeConfig.accent,
                  color: theme === 'hacker' ? '#000' : '#fff',
                }}
              >
                <Sparkles size={14} />
                <span>Agregar al Grafo</span>
              </button>
            </form>
          )}

          {/* TAB: ASPECTOS */}
          {activePopover === 'areas' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateArea} className="space-y-2 p-3 rounded-xl border" style={{ borderColor: themeConfig.borderSubtle, backgroundColor: themeConfig.bgCanvas }}>
                <div className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
                  <FolderPlus size={12} />
                  <span>Nuevo Aspecto de Vida</span>
                </div>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Ej. Espiritualidad, Finanzas..."
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none border"
                  style={{
                    backgroundColor: themeConfig.bgSurface,
                    borderColor: themeConfig.borderSubtle,
                    color: themeConfig.textPrimary,
                  }}
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {DEFAULT_AREA_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewAreaColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${newAreaColor === c ? 'scale-125 ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: themeConfig.accent, color: theme === 'hacker' ? '#000' : '#fff' }}
                  >
                    Crear
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {areas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-2 rounded-lg text-xs border"
                    style={{ borderColor: themeConfig.borderSubtle, backgroundColor: `${themeConfig.bgElevated}60` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
                      <span className={area.visible ? '' : 'opacity-40 line-through'}>{area.name}</span>
                    </div>
                    <button
                      onClick={() => onToggleAreaVisibility(area.id)}
                      className="p-1 rounded hover:opacity-75"
                      style={{ color: area.visible ? themeConfig.accent : themeConfig.textMuted }}
                    >
                      {area.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: FILTROS & VISTA */}
          {activePopover === 'filters' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:opacity-90" style={{ borderColor: themeConfig.borderSubtle }}>
                <span className="text-xs">Etiquetas de texto en nodos</span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ showLabels: e.target.checked })}
                  className="accent-current cursor-pointer"
                  style={{ color: themeConfig.accent }}
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:opacity-90" style={{ borderColor: themeConfig.borderSubtle }}>
                <span className="text-xs">Trazados ultra-finos de áreas (Hulls)</span>
                <input
                  type="checkbox"
                  checked={settings.showAreaHulls}
                  onChange={(e) => onUpdateSettings({ showAreaHulls: e.target.checked })}
                  className="accent-current cursor-pointer"
                  style={{ color: themeConfig.accent }}
                />
              </label>

              <div className="pt-2">
                <span className="block text-[11px] uppercase tracking-wider mb-2 font-medium" style={{ color: themeConfig.textMuted }}>
                  Aislar Aspectos
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {areas.map((area) => {
                    const isFiltered =
                      settings.activeAreaFilters.length === 0 ||
                      settings.activeAreaFilters.includes(area.id);
                    return (
                      <label
                        key={area.id}
                        className="flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer hover:opacity-80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                          <span className={isFiltered ? '' : 'opacity-40'}>{area.name}</span>
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
                          className="accent-current cursor-pointer"
                          style={{ color: themeConfig.accent }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SELECTOR DE TEMAS */}
          {activePopover === 'themes' && (
            <div className="space-y-2">
              {[
                { id: 'linear', name: 'Linear Dark', desc: 'Negro abisal, bordes sutiles, índigo' },
                { id: 'zen', name: 'Zen Slate', desc: 'Gris mate suave, acento salvia calmado' },
                { id: 'editorial', name: 'Swiss Mono', desc: 'Laboratorio suizo, monocromo de alta precisión' },
                { id: 'hacker', name: 'Cyber Terminal', desc: 'Fósforo CRT verde sobre negro puro' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id as any);
                    setActivePopover(null);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left border transition-all ${
                    theme === t.id ? 'shadow-md ring-1 ring-current' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: theme === t.id ? themeConfig.bgElevated : 'transparent',
                    borderColor: theme === t.id ? themeConfig.accent : themeConfig.borderSubtle,
                    color: themeConfig.textPrimary,
                  }}
                >
                  <div>
                    <div className="font-semibold text-xs">{t.name}</div>
                    <div className="text-[10px]" style={{ color: themeConfig.textMuted }}>{t.desc}</div>
                  </div>
                  {theme === t.id && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${themeConfig.accent}25`, color: themeConfig.accent }}>
                      Activo
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FLOATING DOCK PILL (RAYCAST / DYNAMIC ISLAND STYLE) */}
      <nav
        aria-label="Controles principales"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 h-12 px-2.5 rounded-full flex items-center gap-1 z-30 shadow-2xl backdrop-blur-2xl transition-all duration-300 border"
        style={{
          backgroundColor: `${themeConfig.bgSurface}e0`,
          borderColor: themeConfig.borderStrong,
        }}
      >
        {/* + Actividad Action */}
        <button
          onClick={() => togglePopover('activity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activePopover === 'activity' ? 'shadow-md' : 'hover:opacity-90'
          }`}
          style={{
            backgroundColor: activePopover === 'activity' ? themeConfig.accent : `${themeConfig.bgElevated}`,
            color: activePopover === 'activity' ? (theme === 'hacker' ? '#000' : '#fff') : themeConfig.textPrimary,
          }}
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
            activePopover === 'areas' ? 'opacity-100' : 'hover:opacity-80'
          }`}
          style={{
            backgroundColor: activePopover === 'areas' ? `${themeConfig.accent}20` : 'transparent',
            color: activePopover === 'areas' ? themeConfig.accent : themeConfig.textSecondary,
          }}
        >
          <Layers size={16} />
        </button>

        {/* Filtros Action */}
        <button
          onClick={() => togglePopover('filters')}
          title="Filtros y Visibilidad"
          className={`p-2 rounded-full transition-colors ${
            activePopover === 'filters' ? 'opacity-100' : 'hover:opacity-80'
          }`}
          style={{
            backgroundColor: activePopover === 'filters' ? `${themeConfig.accent}20` : 'transparent',
            color: activePopover === 'filters' ? themeConfig.accent : themeConfig.textSecondary,
          }}
        >
          <SlidersHorizontal size={16} />
        </button>

        <div className="w-[1px] h-4 mx-0.5" style={{ backgroundColor: themeConfig.borderSubtle }} />

        {/* Theme Switcher Action */}
        <button
          onClick={() => togglePopover('themes')}
          title={`Tema actual: ${themeConfig.name} (T para alternar)`}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-colors ${
            activePopover === 'themes' ? 'opacity-100' : 'hover:opacity-80'
          }`}
          style={{
            backgroundColor: activePopover === 'themes' ? `${themeConfig.accent}20` : 'transparent',
            color: activePopover === 'themes' ? themeConfig.accent : themeConfig.textSecondary,
          }}
        >
          <Palette size={14} />
          <span className="text-[11px] font-mono font-medium">{themeConfig.badge}</span>
        </button>
      </nav>
    </>
  );
};
