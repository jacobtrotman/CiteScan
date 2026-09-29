// Switching the home-screen icon (Pro). Needs the native module from a real build;
// in Expo Go it isn't available, so the choice is saved and applied once installed.
import { requireOptionalNativeModule } from 'expo';
import { DEFAULT_ICON, ICONS } from './palette';

type IconModule = typeof import('expo-alternate-app-icons');

let iconModule: IconModule | null | undefined;

function getModule(): IconModule | null {
  if (iconModule === undefined) {
    // Check for the native side first: requiring the package without it throws an
    // uncatchable error in development builds (e.g. in Expo Go).
    iconModule = requireOptionalNativeModule('ExpoAlternateAppIcons')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('expo-alternate-app-icons') as IconModule)
      : null;
  }
  return iconModule;
}

export const APP_ICONS = ICONS;

/** Whether this build can change its icon (false in Expo Go). */
export function canChangeAppIcon(): boolean {
  try {
    return getModule()?.supportsAlternateIcons ?? false;
  } catch {
    return false;
  }
}

/** The icon names in app.json are the icon ids in PascalCase; the default icon has no name. */
function iconName(id: string): string | null {
  return id === DEFAULT_ICON ? null : id.charAt(0).toUpperCase() + id.slice(1);
}

export async function applyAppIcon(id: string) {
  if (!canChangeAppIcon()) return;
  const module = getModule()!;
  const wanted = iconName(id) as any;
  if (module.getAppIconName() === wanted) return;
  try {
    await module.setAlternateAppIcon(wanted);
  } catch (err) {
    console.warn('Could not change app icon:', err);
  }
}
