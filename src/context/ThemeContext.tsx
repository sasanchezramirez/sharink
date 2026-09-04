import React, { createContext, useContext, useState } from 'react';

export type ThemeMode = 'linear' | 'zen' | 'editorial' | 'hacker';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  badge: string;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  fontFamily: string;
}

export const THEMES: Record<ThemeMode, ThemeConfig> = {
  linear: {
    id: 'linear',
    name: 'Linear Dark',
    badge: 'Linear',
    bgCanvas: '#08090a',
    bgSurface: '#101216',
    bgElevated: '#171920',
    borderSubtle: 'rgba(255, 255, 255, 0.07)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    accent: '#5e6ad2',
    fontFamily: 'font-sans',
  },
  zen: {
    id: 'zen',
    name: 'Zen Slate',
    badge: 'Zen',
    bgCanvas: '#111418',
    bgSurface: '#181c22',
    bgElevated: '#20252e',
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderStrong: 'rgba(255, 255, 255, 0.10)',
    textPrimary: '#e4e7eb',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#2dd4bf',
    fontFamily: 'font-sans',
  },
  editorial: {
    id: 'editorial',
    name: 'Swiss Mono',
    badge: 'Swiss',
    bgCanvas: '#0c0d0e',
    bgSurface: '#141618',
    bgElevated: '#1b1d22',
    borderSubtle: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.25)',
    textPrimary: '#fafafa',
    textSecondary: '#a3a3a3',
    textMuted: '#525252',
    accent: '#e5e7eb',
    fontFamily: 'font-mono',
  },
  hacker: {
    id: 'hacker',
    name: 'Cyber Terminal',
    badge: 'CRT',
    bgCanvas: '#000300',
    bgSurface: '#030d03',
    bgElevated: '#061706',
    borderSubtle: 'rgba(34, 197, 94, 0.22)',
    borderStrong: 'rgba(34, 197, 94, 0.45)',
    textPrimary: '#4ade80',
    textSecondary: '#22c55e',
    textMuted: '#15803d',
    accent: '#22c55e',
    fontFamily: 'font-mono',
  },
};

const THEME_STORAGE_KEY = 'sharink_theme_preference_v1';

interface ThemeContextType {
  theme: ThemeMode;
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      return saved && THEMES[saved] ? saved : 'linear';
    } catch {
      return 'linear';
    }
  });

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch (e) {
      console.error(e);
    }
  };

  const cycleTheme = () => {
    const list: ThemeMode[] = ['linear', 'zen', 'editorial', 'hacker'];
    const idx = list.indexOf(theme);
    setTheme(list[(idx + 1) % list.length]);
  };

  const themeConfig = THEMES[theme];

  return (
    <ThemeContext.Provider value={{ theme, themeConfig, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
