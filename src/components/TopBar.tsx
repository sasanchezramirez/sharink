import React from 'react';
import { ViewMode } from '../types';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, SlidersHorizontal, Sparkles } from 'lucide-react';

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  totalHours: number;
  onToggleToolbar: () => void;
  isToolbarOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  totalHours,
  onToggleToolbar,
  isToolbarOpen,
}) => {
  // Navigate date
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

  // Format date display
  const formatDateLabel = () => {
    if (viewMode === 'global') return 'Historial Acumulado Global';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (viewMode === 'day') {
      return dateObj.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } else if (viewMode === 'week') {
      return `Semana del ${dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
    } else {
      return dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
  };

  return (
    <header className="h-16 border-b border-gray-800/80 bg-[#0d1017]/90 backdrop-blur-xl px-6 flex items-center justify-between z-30 select-none">
      {/* Brand Title & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="text-white" size={19} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-rose-400">
              sharink
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
              v1.0
            </span>
          </div>
          <p className="text-[10px] text-gray-400 hidden sm:block">
            Visualizador espacial de tiempo y bienestar
          </p>
        </div>
      </div>

      {/* Center: View Mode Selector & Date Controls (A1) */}
      <div className="flex items-center gap-2">
        {/* Mode Selector Tabs */}
        <div className="flex p-1 rounded-xl bg-gray-900/90 border border-gray-800">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Date Navigation (if not global) */}
        {viewMode !== 'global' && (
          <div className="flex items-center gap-1 bg-gray-900/90 border border-gray-800 rounded-xl px-2 py-1">
            <button
              onClick={handlePrevDate}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-1 text-xs font-medium text-gray-200 hover:text-white flex items-center gap-1.5"
            >
              <Calendar size={13} className="text-cyan-400" />
              <span>{formatDateLabel()}</span>
            </button>
            <button
              onClick={handleNextDate}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Hours Counter (CA2, A2) and Lateral Toolbar Toggle (CA6) */}
      <div className="flex items-center gap-4">
        {/* Hours Counter & Limit Warning */}
        <div
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
            isDayOverLimit
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              : 'bg-gray-900/90 border-gray-800 text-gray-200'
          }`}
          title={
            isDayOverLimit
              ? 'Atención: Has registrado más de 24 horas para este día (Asunción A2)'
              : 'Total de horas en la vista activa'
          }
        >
          {isDayOverLimit && <AlertTriangle size={15} className="text-amber-400 animate-pulse" />}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Total Tiempo</div>
            <div className="text-xs font-mono font-bold flex items-center gap-1">
              <span>{totalHours.toFixed(1)}h</span>
              {viewMode === 'day' && <span className="text-gray-500 font-normal">/ 24h</span>}
            </div>
          </div>

          {viewMode === 'day' && (
            <div className="w-10 h-1.5 rounded-full bg-gray-800 overflow-hidden ml-1">
              <div
                className={`h-full rounded-full transition-all ${
                  isDayOverLimit ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                }`}
                style={{ width: `${dayProgressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Toolbar Trigger Button */}
        <button
          onClick={onToggleToolbar}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
            isToolbarOpen
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
              : 'bg-gray-900/90 text-gray-300 hover:text-white border-gray-800 hover:border-gray-700'
          }`}
        >
          <SlidersHorizontal size={15} />
          <span className="hidden md:inline">Simulador & Herramientas</span>
        </button>
      </div>
    </header>
  );
};
