// Colour choices for themes (Pro) and app icons. Every choice has a light and a dark variant.
// Keep the accent colours in sync with scripts/make-icons.mjs.

export type Mode = 'light' | 'dark';

interface AccentVariant {
  /** Filled buttons and badges. */
  primary: string;
  /** Text on `primary`. */
  primaryText: string;
  /** Tinted backgrounds behind icons, selected rows. */
  primarySoft: string;
  /** Logo, icons, links. */
  accent: string;
}

export interface AccentChoice {
  id: string;
  name: string;
  light: AccentVariant;
  dark: AccentVariant;
}

export const ACCENTS: AccentChoice[] = [
  {
    id: 'classic',
    name: 'Classic',
    light: { primary: '#0891B2', primaryText: '#FFFFFF', primarySoft: '#DDF7FB', accent: '#0AA5C2' },
    dark: { primary: '#8B5CF6', primaryText: '#FFFFFF', primarySoft: '#231B3D', accent: '#A78BFA' },
  },
  {
    id: 'cyan',
    name: 'Cyan',
    light: { primary: '#0891B2', primaryText: '#FFFFFF', primarySoft: '#DDF7FB', accent: '#0AA5C2' },
    dark: { primary: '#22D3EE', primaryText: '#00171C', primarySoft: '#0B2A33', accent: '#22D3EE' },
  },
  {
    id: 'violet',
    name: 'Violet',
    light: { primary: '#7C3AED', primaryText: '#FFFFFF', primarySoft: '#EEE7FF', accent: '#7C3AED' },
    dark: { primary: '#8B5CF6', primaryText: '#FFFFFF', primarySoft: '#231B3D', accent: '#A78BFA' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { primary: '#2563EB', primaryText: '#FFFFFF', primarySoft: '#E3ECFF', accent: '#2563EB' },
    dark: { primary: '#3B82F6', primaryText: '#FFFFFF', primarySoft: '#172554', accent: '#60A5FA' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    light: { primary: '#059669', primaryText: '#FFFFFF', primarySoft: '#DDF5EC', accent: '#059669' },
    dark: { primary: '#34D399', primaryText: '#03170F', primarySoft: '#0F2E24', accent: '#34D399' },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { primary: '#E11D48', primaryText: '#FFFFFF', primarySoft: '#FFE4EA', accent: '#E11D48' },
    dark: { primary: '#FB7185', primaryText: '#2A0710', primarySoft: '#3B1520', accent: '#FB7185' },
  },
  {
    id: 'amber',
    name: 'Gold',
    light: { primary: '#A16207', primaryText: '#FFFFFF', primarySoft: '#FEF6D8', accent: '#A16207' },
    dark: { primary: '#FACC15', primaryText: '#1F1A00', primarySoft: '#363008', accent: '#FACC15' },
  },
  {
    id: 'orange',
    name: 'Orange',
    light: { primary: '#EA580C', primaryText: '#FFFFFF', primarySoft: '#FFEADB', accent: '#EA580C' },
    dark: { primary: '#FB923C', primaryText: '#241002', primarySoft: '#3B2111', accent: '#FB923C' },
  },
  {
    id: 'mono',
    name: 'Mono',
    light: { primary: '#18181B', primaryText: '#FFFFFF', primarySoft: '#EDEDEF', accent: '#18181B' },
    dark: { primary: '#F4F4F5', primaryText: '#09090B', primarySoft: '#27272A', accent: '#F4F4F5' },
  },
];

interface BackgroundVariant {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
}

export interface BackgroundChoice {
  id: string;
  name: string;
  light: BackgroundVariant;
  dark: BackgroundVariant;
}

export const BACKGROUNDS: BackgroundChoice[] = [
  {
    id: 'classic',
    name: 'Classic',
    light: { background: '#FFFFFF', card: '#F5F8F9', border: '#DFE9EC', text: '#0F1A1D', muted: '#5E6E73' },
    dark: { background: '#000000', card: '#141417', border: '#27272D', text: '#F2F2F5', muted: '#9A9AA6' },
  },
  {
    id: 'paper',
    name: 'Paper',
    light: { background: '#F6EEDF', card: '#FFFBF3', border: '#E6D8BF', text: '#2A2217', muted: '#76684F' },
    dark: { background: '#241C13', card: '#31271C', border: '#46392A', text: '#F5EBDD', muted: '#B8A68C' },
  },
  {
    id: 'mist',
    name: 'Slate',
    light: { background: '#E4EAF1', card: '#F7F9FC', border: '#CDD6E1', text: '#16202C', muted: '#56657A' },
    dark: { background: '#161C24', card: '#212936', border: '#334052', text: '#E8EDF4', muted: '#95A3B8' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    light: { background: '#E2E6FF', card: '#F5F6FF', border: '#C9CFF5', text: '#141A3D', muted: '#555E8F' },
    dark: { background: '#0A1030', card: '#141C45', border: '#26305F', text: '#EAEDFF', muted: '#9AA3D4' },
  },
  {
    id: 'forest',
    name: 'Forest',
    light: { background: '#E1F0E7', card: '#F5FBF7', border: '#C6DFD0', text: '#10261A', muted: '#4F6B5B' },
    dark: { background: '#0B1F16', card: '#142C21', border: '#244232', text: '#E6F4EC', muted: '#8FB5A0' },
  },
  {
    id: 'blush',
    name: 'Blush',
    light: { background: '#FBE7EA', card: '#FFF6F7', border: '#F1CCD3', text: '#2E1519', muted: '#7D5A61' },
    dark: { background: '#241016', card: '#341A22', border: '#4D2A35', text: '#FBEAEE', muted: '#C497A2' },
  },
];

const STATUS = {
  light: {
    strong: '#1E7F4F',
    strongSoft: '#E3F5EC',
    possible: '#9A6700',
    possibleSoft: '#FFF4D6',
    danger: '#C92A2A',
    quote: '#FFF8E1',
  },
  dark: {
    strong: '#5FD39A',
    strongSoft: '#16362A',
    possible: '#F2C14E',
    possibleSoft: '#3A3016',
    danger: '#FF6B6B',
    quote: '#26221A',
  },
};

export type Theme = BackgroundVariant & AccentVariant & (typeof STATUS)['light'] & { mode: Mode };

export function buildTheme(mode: Mode, accentId = 'classic', backgroundId = 'classic'): Theme {
  const accent = ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0];
  const background = BACKGROUNDS.find((b) => b.id === backgroundId) ?? BACKGROUNDS[0];
  return { mode, ...background[mode], ...accent[mode], ...STATUS[mode] };
}

export interface IconChoice {
  id: string;
  name: string;
  /** Logo colour in light and dark mode (matches scripts/make-icons.mjs). */
  light: string;
  dark: string;
}

/**
 * App icons Pro users can pick. Each is an alternate icon in app.json. Without a choice the app
 * uses its default icon, which is cyan in light mode and purple in dark mode.
 */
export const ICONS: IconChoice[] = [
  { id: 'cyan', name: 'Cyan', light: '#0AA5C2', dark: '#22D3EE' },
  { id: 'violet', name: 'Purple', light: '#7C3AED', dark: '#A78BFA' },
  { id: 'ocean', name: 'Ocean', light: '#2563EB', dark: '#60A5FA' },
  { id: 'emerald', name: 'Emerald', light: '#059669', dark: '#34D399' },
  { id: 'rose', name: 'Rose', light: '#E11D48', dark: '#FB7185' },
  { id: 'amber', name: 'Gold', light: '#A16207', dark: '#FACC15' },
  { id: 'orange', name: 'Orange', light: '#EA580C', dark: '#FB923C' },
  { id: 'mono', name: 'Mono', light: '#18181B', dark: '#F4F4F5' },
];

export const DEFAULT_ICON = 'default';
