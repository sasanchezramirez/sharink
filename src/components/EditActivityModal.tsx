import React, { useState, useEffect } from 'react';
import { Activity, LifeArea, TemperatureScore } from '../types';
import { getTemperatureColor, getTemperatureLabel } from '../utils/colors';
import { X, Trash2, Save, Flame, Clock, Layers, Tag } from 'lucide-react';

interface EditActivityModalProps {
  activity: Activity | null;
  areas: LifeArea[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateActivity: (updated: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
}

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  activity,
  areas,
  isOpen,
  onClose,
  onUpdateActivity,
  onDeleteActivity,
}) => {
  const [name, setName] = useState('');
  const [hours, setHours] = useState('2.0');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<TemperatureScore>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setHours(activity.hours.toString());
      setAreaIds(activity.areaIds);
      setTemperature(activity.temperature);
      setNotes(activity.notes || '');
    }
  }, [activity]);

  if (!isOpen || !activity) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onUpdateActivity({
      ...activity,
      name: name.trim(),
      hours: Math.max(0.1, parseFloat(hours) || 1),
      areaIds: areaIds.length > 0 ? areaIds : [areas[0]?.id || 'default'],
      temperature,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const toggleArea = (id: string) => {
    setAreaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDelete = () => {
    if (confirm(`¿Eliminar la actividad "${activity.name}"?`)) {
      onDeleteActivity(activity.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl p-6 text-gray-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full shadow-md"
              style={{ backgroundColor: getTemperatureColor(temperature) }}
            />
            <h3 className="font-bold text-base text-white">Editar Actividad</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Tag size={13} className="text-cyan-400" />
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Hours */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-400" />
                Horas Dedicadas
              </span>
              <span className="font-mono text-xs text-indigo-300 font-bold">{hours}h</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.25"
                max="12"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
              />
              <input
                type="number"
                min="0.1"
                max="24"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-16 px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 text-xs font-mono text-center text-white"
              />
            </div>
          </div>

          {/* Areas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Layers size={13} className="text-purple-400" />
              Aspectos de Vida (Multiselección)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {areas.map((area) => {
                const isSelected = areaIds.includes(area.id);
                return (
                  <button
                    type="button"
                    key={area.id}
                    onClick={() => toggleArea(area.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                      isSelected
                        ? 'bg-indigo-900/60 border-indigo-500 text-white font-medium'
                        : 'bg-gray-900 border-gray-800 text-gray-400'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    <span>{area.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Flame size={13} className="text-rose-400" />
                Temperatura Vital
              </label>
              <span className={`text-xs font-bold ${getTemperatureLabel(temperature).textClass}`}>
                {temperature > 0 ? `+${temperature.toFixed(1)}` : temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.5"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer h-2.5 rounded-lg appearance-none bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shadow-inner"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
