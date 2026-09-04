import React from 'react';
import { ViewMode } from '../types';
import { useTheme } from '../context/ThemeContext';
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
  const { themeConfig } = useTheme();

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
    if (viewMode === 'global') return 'Historial Completo';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (viewMode === 'day') {
      return dateObj.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } else if (viewMode === 'week') {
      return `Sem. ${dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
    } else {
      return dateObj.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    }
  };

  return (
    <header
      className="h-11 px-5 flex items-center justify-between z-30 select-none backdrop-blur-xl border-b transition-colors duration-500"
      style={{
        backgroundColor: `${themeConfig.bgCanvas}c0`,
        borderColor: themeConfig.borderSubtle,
        color: themeConfig.textPrimary,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span
          className="font-bold text-sm tracking-tight"
          style={{ color: themeConfig.textPrimary }}
        >
          sharink
        </span>
        <span
          className="text-[9px] font-mono px-1 rounded uppercase tracking-wider"
          style={{
            backgroundColor: `${themeConfig.accent}15`,
            color: themeConfig.accent,
          }}
        >
          {themeConfig.badge}
        </span>
      </div>

      {/* Center: View Modes & Date */}
      <div className="flex items-center gap-2">
        {/* Segmented Modes */}
        <div
          className="flex p-0.5 rounded-full border text-[11px]"
          style={{
            backgroundColor: `${themeConfig.bgSurface}90`,
            borderColor: themeConfig.borderSubtle,
          }}
        >
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
                className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
                  isActive ? 'shadow-sm' : 'hover:opacity-75'
                }`}
                style={{
                  backgroundColor: isActive ? themeConfig.bgElevated : 'transparent',
                  color: isActive ? themeConfig.textPrimary : themeConfig.textMuted,
                }}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Date Controls */}
        {viewMode !== 'global' && (
          <div
            className="flex items-center rounded-full border px-1 py-0.5 text-[11px]"
            style={{
              backgroundColor: `${themeConfig.bgSurface}90`,
              borderColor: themeConfig.borderSubtle,
            }}
          >
            <button
              onClick={handlePrevDate}
              className="p-1 rounded-full hover:opacity-75"
              style={{ color: themeConfig.textSecondary }}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleToday}
              className="px-2 font-mono font-medium hover:opacity-75"
              style={{ color: themeConfig.textPrimary }}
            >
              {formatDateLabel()}
            </button>
            <button
              onClick={handleNextDate}
              className="p-1 rounded-full hover:opacity-75"
              style={{ color: themeConfig.textSecondary }}
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
            <span className="font-semibold" style={{ color: themeConfig.textPrimary }}>
              {totalHours.toFixed(1)}h
            </span>
            {viewMode === 'day' && (
              <span className="text-[10px]" style={{ color: themeConfig.textMuted }}>
                / 24h
              </span>
            )}
          </div>
          {viewMode === 'day' && (
            <div
              className="w-12 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: `${themeConfig.borderStrong}` }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${dayProgressPercent}%`,
                  backgroundColor: isDayOverLimit ? '#f59e0b' : themeConfig.accent,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
