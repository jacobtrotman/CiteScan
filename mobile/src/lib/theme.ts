import { useAppState } from './app-state';

export type { Theme } from './palette';

/** The active theme: follows the phone's appearance (or the user's override) and, for Pro, their colours. */
export function useTheme() {
  return useAppState().theme;
}
