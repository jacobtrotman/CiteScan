// App-wide state: the user's appearance preferences, their purchase access, and the
// resulting theme. Accent, background and icon choices only apply for Pro users.
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { applyAppIcon } from './app-icon';
import { buildTheme, DEFAULT_ICON, ICONS, type Theme } from './palette';
import { getAccess, type Access } from './purchases';

export type ModePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  mode: ModePreference;
  accent: string;
  background: string;
  icon: string;
}

const DEFAULT_PREFS: Preferences = { mode: 'system', accent: 'classic', background: 'classic', icon: DEFAULT_ICON };

const prefsFile = new File(Paths.document, 'preferences.json');

function loadPrefs(): Preferences {
  try {
    if (prefsFile.exists) {
      const saved: Preferences = { ...DEFAULT_PREFS, ...JSON.parse(prefsFile.textSync()) };
      // Older versions had a "classic" icon; fall back to the default for anything unknown.
      if (!ICONS.some((i) => i.id === saved.icon)) saved.icon = DEFAULT_ICON;
      return saved;
    }
  } catch {
    // corrupt file: fall back to defaults
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: Preferences) {
  if (!prefsFile.exists) prefsFile.create();
  prefsFile.write(JSON.stringify(prefs));
}

interface AppState {
  theme: Theme;
  prefs: Preferences;
  setPrefs: (changes: Partial<Preferences>) => void;
  access: Access | null;
  refreshAccess: () => Promise<Access | null>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [prefs, setPrefsState] = useState<Preferences>(loadPrefs);
  const [access, setAccess] = useState<Access | null>(null);

  const refreshAccess = useCallback(async () => {
    try {
      const next = await getAccess();
      setAccess(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    getAccess()
      .then(setAccess)
      .catch(() => {});
  }, []);

  const setPrefs = useCallback((changes: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next = { ...current, ...changes };
      savePrefs(next);
      return next;
    });
  }, []);

  const isPro = access?.isPro ?? false;

  // If Pro lapses, go back to the standard icon.
  useEffect(() => {
    if (access) applyAppIcon(isPro ? prefs.icon : DEFAULT_ICON);
  }, [access, isPro, prefs.icon]);

  const theme = useMemo(() => {
    const mode = prefs.mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : prefs.mode;
    return isPro ? buildTheme(mode, prefs.accent, prefs.background) : buildTheme(mode);
  }, [prefs, systemScheme, isPro]);

  const value = useMemo(
    () => ({ theme, prefs, setPrefs, access, refreshAccess }),
    [theme, prefs, setPrefs, access, refreshAccess],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState must be used inside AppStateProvider');
  return state;
}
