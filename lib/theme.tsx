import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { getSetting, setSetting } from './db';

export type ThemeMode = 'dark' | 'light';

export interface Colors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  present: string;
  absent: string;
  half: string;
  leave: string;
  off: string;
  warn: string;
  warnText: string;
}

const dark: Colors = {
  bg: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1E2631',
  border: '#2A3441',
  text: '#F2F5F8',
  muted: '#8A97A6',
  primary: '#2DD4BF',
  onPrimary: '#04211E',
  present: '#22C55E',
  absent: '#F05252',
  half: '#F59E0B',
  leave: '#818CF8',
  off: '#4B5563',
  warn: '#3A2E12',
  warnText: '#FBBF24',
};

const light: Colors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#E4E7EC',
  text: '#101828',
  muted: '#667085',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  present: '#12B76A',
  absent: '#F04438',
  half: '#F79009',
  leave: '#6172F3',
  off: '#98A2B3',
  warn: '#FEF0C7',
  warnText: '#B54708',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

const THEME_KEY = 'theme_mode';

interface ThemeValue {
  mode: ThemeMode;
  colors: Colors;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** Dark is the default; the stored preference only overrides it. */
export function readStoredMode(): ThemeMode {
  return getSetting(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setSetting(THEME_KEY, next);
  }, []);

  const toggle = useCallback(
    () => setMode(mode === 'dark' ? 'light' : 'dark'),
    [mode, setMode],
  );

  const value = useMemo<ThemeValue>(
    () => ({ mode, colors: mode === 'dark' ? dark : light, toggle, setMode }),
    [mode, toggle, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
