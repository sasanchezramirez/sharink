import React from 'react';
import { ViewMode } from '../types';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  totalHours: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  totalHours,
}) => {
  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onDateChange(new Date().toISOString().split('T')[0]);
  };

  const isDayOverLimit = viewMode === 'day' && totalHours > 24;
  const dayProgressPercent = Math.min(100, Math.round((totalHours / 24) * 100));

  const formatDateLabel = () => {
    if (viewMode === 'global') return 'Todo el Historial';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (viewMode === 'day') {
      return dateObj.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } else if (viewMode === 'week') {
      return `Semana del ${dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
    } else {
      return dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
  };

  return (
    <header className="h-11 px-6 flex items-center justify-between z-30 select-none bg-[#08090d]/90 backdrop-blur-xl border-b border-white/5 text-gray-200">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <span className="font-semibold text-xs tracking-wider uppercase text-gray-100">
          sharink
        </span>
        <span className="w-1 h-1 rounded-full bg-indigo-500/80" />
        <span className="text-[10px] text-gray-500 font-mono">espacio vital</span>
      </div>

      {/* Center: View Modes & Date */}
      <div className="flex items-center gap-2">
        {/* Segmented Modes */}
        <div className="flex p-0.5 rounded-full bg-[#12141c] border border-white/5 text-[11px]">
          {(['day', 'week', 'month', 'global'] as ViewMode[]).map((mode) => {
            const labels: Record<ViewMode, string> = {
              day: 'Día',
              week: 'Semana',
              month: 'Mes',
              global: 'Global',
            };
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`px-3 py-0.5 rounded-full font-medium transition-all ${
                  isActive
                    ? 'bg-[#1e2230] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Date Navigator */}
        {viewMode !== 'global' && (
          <div className="flex items-center rounded-full bg-[#12141c] border border-white/5 px-1 py-0.5 text-[11px]">
            <button
              onClick={handlePrevDate}
              className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleToday}
              className="px-2 font-mono text-gray-200 hover:text-white transition-colors"
            >
              {formatDateLabel()}
            </button>
            <button
              onClick={handleNextDate}
              className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Hours meter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isDayOverLimit && <AlertTriangle size={13} className="text-amber-400" />}
          <div className="flex items-baseline gap-1 text-xs font-mono">
            <span className="font-semibold text-gray-200">{totalHours.toFixed(1)}h</span>
            {viewMode === 'day' && <span className="text-[10px] text-gray-500">/ 24h</span>}
          </div>
          {viewMode === 'day' && (
            <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isDayOverLimit ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${dayProgressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
