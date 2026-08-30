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
export type AccentKey = 'blue' | 'violet' | 'rose' | 'gold';

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

type BaseColors = Omit<Colors, 'primary' | 'onPrimary'>;

const dark: BaseColors = {
  bg: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1E2631',
  border: '#2A3441',
  text: '#F2F5F8',
  muted: '#8A97A6',
  present: '#22C55E',
  absent: '#F05252',
  half: '#F59E0B',
  leave: '#818CF8',
  off: '#4B5563',
  warn: '#3A2E12',
  warnText: '#FBBF24',
};

const light: BaseColors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#E4E7EC',
  text: '#101828',
  muted: '#667085',
  present: '#12B76A',
  absent: '#F04438',
  half: '#F79009',
  leave: '#6172F3',
  off: '#98A2B3',
  warn: '#FEF0C7',
  warnText: '#B54708',
};

/**
 * Dark mode wants a bright, saturated shade that pops off a near-black
 * background (paired with a dark onPrimary); light mode wants a deep shade
 * with enough contrast for white text — same pattern the original teal used,
 * just parameterized per accent. Gold is deliberately more mustard/brown
 * than `half`'s amber so premium badges and the primary accent don't read
 * as the same color.
 */
const ACCENTS: Record<AccentKey, { dark: Pick<Colors, 'primary' | 'onPrimary'>; light: Pick<Colors, 'primary' | 'onPrimary'> }> = {
  blue: {
    dark: { primary: '#60A5FA', onPrimary: '#0B2545' },
    light: { primary: '#1D4ED8', onPrimary: '#FFFFFF' },
  },
  violet: {
    dark: { primary: '#A78BFA', onPrimary: '#2E1065' },
    light: { primary: '#6D28D9', onPrimary: '#FFFFFF' },
  },
  rose: {
    dark: { primary: '#FB7185', onPrimary: '#4C0519' },
    light: { primary: '#BE123C', onPrimary: '#FFFFFF' },
  },
  gold: {
    dark: { primary: '#D4A017', onPrimary: '#3A2A00' },
    light: { primary: '#92400E', onPrimary: '#FFFFFF' },
  },
};

export const ACCENT_KEYS: AccentKey[] = ['blue', 'violet', 'rose', 'gold'];
export const ACCENT_SWATCH: Record<AccentKey, string> = {
  blue: ACCENTS.blue.dark.primary,
  violet: ACCENTS.violet.dark.primary,
  rose: ACCENTS.rose.dark.primary,
  gold: ACCENTS.gold.dark.primary,
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

const THEME_KEY = 'theme_mode';
const ACCENT_KEY = 'accent_color';
const DEFAULT_ACCENT: AccentKey = 'blue';

interface ThemeValue {
  mode: ThemeMode;
  colors: Colors;
  accent: AccentKey;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** Dark is the default; the stored preference only overrides it. */
export function readStoredMode(): ThemeMode {
  return getSetting(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function readStoredAccent(): AccentKey {
  const stored = getSetting(ACCENT_KEY);
  return stored && ACCENT_KEYS.includes(stored as AccentKey)
    ? (stored as AccentKey)
    : DEFAULT_ACCENT;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [accent, setAccentState] = useState<AccentKey>(readStoredAccent);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setSetting(THEME_KEY, next);
  }, []);

  const setAccent = useCallback((next: AccentKey) => {
    setAccentState(next);
    setSetting(ACCENT_KEY, next);
  }, []);

  const toggle = useCallback(
    () => setMode(mode === 'dark' ? 'light' : 'dark'),
    [mode, setMode],
  );

  const value = useMemo<ThemeValue>(() => {
    const base = mode === 'dark' ? dark : light;
    const accentColors = ACCENTS[accent][mode];
    return {
      mode,
      accent,
      colors: { ...base, ...accentColors },
      toggle,
      setMode,
      setAccent,
    };
  }, [mode, accent, toggle, setMode, setAccent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
