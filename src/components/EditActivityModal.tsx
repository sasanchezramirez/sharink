import React, { useState, useEffect } from 'react';
import { Activity, LifeArea, TemperatureScore } from '../types';
import { getTemperatureColor, getTemperatureLabel } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
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
  const { theme, themeConfig } = useTheme();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4"
        style={{
          backgroundColor: `${themeConfig.bgSurface}f8`,
          borderColor: themeConfig.borderStrong,
          color: themeConfig.textPrimary,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: themeConfig.borderSubtle }}>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getTemperatureColor(temperature, theme) }}
            />
            <h3 className="font-semibold text-xs uppercase tracking-wider">
              Editar Actividad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:opacity-75 transition-opacity"
            style={{ color: themeConfig.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
              <Tag size={12} />
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl text-xs outline-none border"
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
                Horas Dedicadas
              </span>
              <span className="font-mono font-bold" style={{ color: themeConfig.accent }}>
                {hours}h
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.25"
                max="12"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full h-1.5 rounded-lg cursor-pointer accent-current"
                style={{ color: themeConfig.accent, backgroundColor: themeConfig.bgCanvas }}
              />
              <input
                type="number"
                min="0.1"
                max="24"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-14 px-1.5 py-1 rounded-lg text-xs font-mono text-center border"
                style={{
                  backgroundColor: themeConfig.bgCanvas,
                  borderColor: themeConfig.borderSubtle,
                  color: themeConfig.textPrimary,
                }}
              />
            </div>
          </div>

          {/* Areas */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
              <Layers size={12} />
              Aspectos de Vida
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {areas.map((area) => {
                const isSelected = areaIds.includes(area.id);
                return (
                  <button
                    type="button"
                    key={area.id}
                    onClick={() => toggleArea(area.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                      isSelected ? 'font-medium shadow-sm' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: isSelected ? themeConfig.bgElevated : 'transparent',
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

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px]">
              <span className="font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: themeConfig.textSecondary }}>
                <Flame size={12} />
                Temperatura Vital
              </span>
              <span className={`font-semibold ${getTemperatureLabel(temperature).textClass}`}>
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
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-rose-500 via-slate-400 to-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: themeConfig.textSecondary }}>
              Notas / Reflexiones
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 rounded-xl text-xs outline-none border"
              style={{
                backgroundColor: themeConfig.bgCanvas,
                borderColor: themeConfig.borderSubtle,
                color: themeConfig.textPrimary,
              }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: themeConfig.borderSubtle }}>
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-medium hover:opacity-75"
                style={{ color: themeConfig.textMuted }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-md"
                style={{
                  backgroundColor: themeConfig.accent,
                  color: theme === 'hacker' ? '#000' : '#fff',
                }}
              >
                <Save size={13} />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
