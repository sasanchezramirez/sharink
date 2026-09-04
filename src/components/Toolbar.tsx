import React, { useState } from 'react';
import { Activity, LifeArea, ViewportSettings, TemperatureScore } from '../types';
import { getTemperatureColor, getTemperatureLabel, DEFAULT_AREA_COLORS } from '../utils/colors';
import {
  PlusCircle,
  FolderPlus,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Tag,
  Clock,
  Flame,
  X,
  Sliders,
} from 'lucide-react';

interface ToolbarProps {
  areas: LifeArea[];
  settings: ViewportSettings;
  isOpen: boolean;
  onClose: () => void;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  onAddArea: (name: string, color: string) => void;
  onToggleAreaVisibility: (areaId: string) => void;
  onUpdateSettings: (newSettings: Partial<ViewportSettings>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  areas,
  settings,
  isOpen,
  onClose,
  onAddActivity,
  onAddArea,
  onToggleAreaVisibility,
  onUpdateSettings,
}) => {
  // Tabs within Toolbar: 'activity' | 'areas' | 'display'
  const [activeTab, setActiveTab] = useState<'activity' | 'areas' | 'display'>('activity');

  // New Activity Form State (CA6)
  const [actName, setActName] = useState('');
  const [actHours, setActHours] = useState('2.0');
  const [actAreaIds, setActAreaIds] = useState<string[]>(areas.length > 0 ? [areas[0].id] : []);
  const [actTemperature, setActTemperature] = useState<TemperatureScore>(3.0);
  const [actNotes, setActNotes] = useState('');

  // New Area Form State (CA7)
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaColor, setNewAreaColor] = useState(DEFAULT_AREA_COLORS[0]);

  // Handle Create Activity
  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actName.trim()) return;

    const hours = parseFloat(actHours) || 1;
    onAddActivity({
      name: actName.trim(),
      hours: Math.max(0.1, hours),
      areaIds: actAreaIds.length > 0 ? actAreaIds : [areas[0]?.id || 'default'],
      temperature: actTemperature,
      date: settings.selectedDate,
      notes: actNotes.trim() || undefined,
    });

    // Reset inputs
    setActName('');
    setActHours('2.0');
    setActNotes('');
  };

  // Toggle area checkbox for new activity
  const toggleAreaForActivity = (areaId: string) => {
    setActAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  // Handle Create Area
  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    onAddArea(newAreaName.trim(), newAreaColor);
    setNewAreaName('');
    // Pick next color
    const nextColorIndex = (DEFAULT_AREA_COLORS.indexOf(newAreaColor) + 1) % DEFAULT_AREA_COLORS.length;
    setNewAreaColor(DEFAULT_AREA_COLORS[nextColorIndex]);
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 border-l border-gray-800/80 bg-[#0d1017]/95 backdrop-blur-xl flex flex-col h-[calc(100vh-4rem)] z-30 shadow-2xl transition-all">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="text-indigo-400" size={18} />
          <h2 className="font-bold text-sm text-gray-100 uppercase tracking-wider">
            Simulador de Vida
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-800/80 p-1 bg-gray-900/50">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'activity'
              ? 'bg-indigo-600/90 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <PlusCircle size={14} />
          <span>+ Actividad</span>
        </button>
        <button
          onClick={() => setActiveTab('areas')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'areas'
              ? 'bg-indigo-600/90 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Layers size={14} />
          <span>Aspectos</span>
        </button>
        <button
          onClick={() => setActiveTab('display')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'display'
              ? 'bg-indigo-600/90 text-white shadow-md'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Eye size={14} />
          <span>Filtros</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: NUEVA ACTIVIDAD (CA6) */}
        {activeTab === 'activity' && (
          <form onSubmit={handleCreateActivity} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Tag size={13} className="text-cyan-400" />
                Nombre de la Actividad
              </label>
              <input
                type="text"
                value={actName}
                onChange={(e) => setActName(e.target.value)}
                placeholder="Ej. Sesión de código, Meditación..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-900 border border-gray-700/70 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-gray-500 shadow-inner"
              />
            </div>

            {/* Hours spent */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-400" />
                  Horas Dedicadas (Radio del nodo)
                </span>
                <span className="font-mono text-xs text-indigo-300 font-bold">{actHours}h</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.25"
                  max="12"
                  step="0.25"
                  value={actHours}
                  onChange={(e) => setActHours(e.target.value)}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
                />
                <input
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.5"
                  value={actHours}
                  onChange={(e) => setActHours(e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 text-xs font-mono text-center text-white"
                />
              </div>
            </div>

            {/* Life Areas selection (supports multi-selection for intersection CA4) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers size={13} className="text-purple-400" />
                  Aspectos / Áreas Asociadas
                </span>
                <span className="text-[10px] text-gray-500">Multiselección</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {areas.map((area) => {
                  const isSelected = actAreaIds.includes(area.id);
                  return (
                    <button
                      type="button"
                      key={area.id}
                      onClick={() => toggleAreaForActivity(area.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-all ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/70 text-white font-medium'
                          : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: area.color }}
                        />
                        <span>{area.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-indigo-400 font-mono">Activo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Temperature Slider with EM Spectrum Preview (CA5 & CA6) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Flame size={13} className="text-rose-400" />
                  Escala de Temperatura Vital
                </label>
                <span className={`text-xs font-bold ${getTemperatureLabel(actTemperature).textClass}`}>
                  {actTemperature > 0 ? `+${actTemperature.toFixed(1)}` : actTemperature.toFixed(1)}
                </span>
              </div>

              {/* Slider with EM spectrum background */}
              <div className="relative py-1">
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={actTemperature}
                  onChange={(e) => setActTemperature(parseFloat(e.target.value))}
                  className="w-full accent-white cursor-pointer h-3 rounded-lg appearance-none bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 mt-1">
                <span className="text-rose-400">-5 Rojo (Drenante)</span>
                <span className="text-gray-300">0 Neutro</span>
                <span className="text-blue-400">+5 Azul (Positivo)</span>
              </div>

              {/* Current preview banner */}
              <div
                className="mt-2.5 p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium"
                style={{
                  backgroundColor: `${getTemperatureColor(actTemperature)}15`,
                  borderColor: `${getTemperatureColor(actTemperature)}50`,
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shadow-md shrink-0"
                  style={{ backgroundColor: getTemperatureColor(actTemperature) }}
                />
                <span className="text-gray-200">
                  Impacto: {getTemperatureLabel(actTemperature).label}
                </span>
              </div>
            </div>

            {/* Notes optional */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Reflexión / Notas (Opcional)
              </label>
              <textarea
                value={actNotes}
                onChange={(e) => setActNotes(e.target.value)}
                placeholder="¿Por qué tuvo esta temperatura? ¿Qué sentiste?"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700/70 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-gray-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98"
            >
              <Sparkles size={16} />
              <span>Simular Actividad en Grafo</span>
            </button>
          </form>
        )}

        {/* TAB 2: GESTIONAR ASPECTOS DE VIDA (CA7) */}
        {activeTab === 'areas' && (
          <div className="space-y-6">
            {/* Create Area Form */}
            <form onSubmit={handleCreateArea} className="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <FolderPlus size={14} />
                Nuevo Aspecto de Vida
              </h3>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Ej. Espiritualidad, Proyectos..."
                required
                className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <div>
                <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">
                  Color Representativo
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_AREA_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewAreaColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newAreaColor === c ? 'border-white scale-125 shadow-md' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                + Añadir Aspecto
              </button>
            </form>

            {/* List of existing areas */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Aspectos Existentes ({areas.length})
              </h3>
              <div className="space-y-2">
                {areas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/50 border border-gray-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: area.color }}
                      />
                      <span className={`font-medium ${area.visible ? 'text-white' : 'text-gray-500 line-through'}`}>
                        {area.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onToggleAreaVisibility(area.id)}
                      title={area.visible ? 'Ocultar aspecto' : 'Mostrar aspecto'}
                      className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
                    >
                      {area.visible ? <Eye size={14} className="text-indigo-400" /> : <EyeOff size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HERRAMIENTAS Y FILTROS DEL GRAFO (CA7 & A8) */}
        {activeTab === 'display' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Ocultar / Mostrar Elementos
              </h3>

              {/* Toggle Labels */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800 cursor-pointer hover:bg-gray-900">
                <span className="text-xs text-gray-300 font-medium">
                  Etiquetas de texto en nodos
                </span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ showLabels: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              {/* Toggle Area Shaded Hulls */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800 cursor-pointer hover:bg-gray-900">
                <span className="text-xs text-gray-300 font-medium">
                  Sombras de fondo de áreas (Hulls)
                </span>
                <input
                  type="checkbox"
                  checked={settings.showAreaHulls}
                  onChange={(e) => onUpdateSettings({ showAreaHulls: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Filter by Area */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Filtrar por Área Específica
              </h3>
              <p className="text-[11px] text-gray-500 mb-2.5">
                Desmarca áreas para aislar y concentrarte en aspectos específicos de tu día.
              </p>
              <div className="space-y-1.5">
                {areas.map((area) => {
                  const isFiltered =
                    settings.activeAreaFilters.length === 0 ||
                    settings.activeAreaFilters.includes(area.id);
                  return (
                    <label
                      key={area.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-900/40 border border-gray-800/80 cursor-pointer hover:bg-gray-900"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: area.color }}
                        />
                        <span className={isFiltered ? 'text-gray-200' : 'text-gray-500'}>
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
                            // Currently all are selected; unchecking this one leaves the rest
                            next = areas.map((a) => a.id).filter((id) => id !== area.id);
                          } else if (current.includes(area.id)) {
                            next = current.filter((id) => id !== area.id);
                          } else {
                            next = [...current, area.id];
                            if (next.length === areas.length) next = [];
                          }
                          onUpdateSettings({ activeAreaFilters: next });
                        }}
                        className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
