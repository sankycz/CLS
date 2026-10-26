import { useEffect, useState } from 'react';

export type Theme = 'day' | 'dark' | 'nvg';

const KEY = 'cls-theme';
const ORDER: Theme[] = ['dark', 'day', 'nvg'];

const readTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'day' || stored === 'dark' || stored === 'nvg') return stored;
  } catch {
    // localStorage nedostupné
  }
  return 'dark';
};

export const THEME_LABEL: Record<Theme, string> = { day: 'DEN', dark: 'TMA', nvg: 'NVG' };

export const useTheme = (): { theme: Theme; cycle: () => void; set: (theme: Theme) => void } => {
  const [theme, set] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#f2f2ee' : '#000000');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // localStorage nedostupné
    }
  }, [theme]);

  const cycle = () => set((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'dark');
  return { theme, cycle, set };
};
