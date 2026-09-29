// Generates the app icon SVGs from the same geometry as src/components/LogoMark.tsx.
// Usage: node scripts/make-icons.mjs <outDir>   (then render each SVG to PNG)
import fs from 'fs';
import path from 'path';

const CYAN = '#0AA5C2';
const PURPLE = '#A78BFA';

const mark = (color) => `
  <path d="M10 30V18Q10 10 18 10H30 M70 10H82Q90 10 90 18V30 M90 70V82Q90 90 82 90H70 M30 90H18Q10 90 10 82V70" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M33 52.5L50 60.5L67 52.5V63Q50 71 33 63Z" fill="${color}"/>
  <path d="M50 30L80 44L50 58L20 44Z" fill="${color}"/>
  <path d="M74 46.8V61" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="74" cy="63" r="2.8" fill="${color}"/>
  <rect x="71.8" y="64.5" width="4.4" height="9" rx="1.5" fill="${color}"/>`;

// scale: how much of the 1024 canvas the 100-unit mark covers.
const icon = ({ color, background, scale }) => {
  const s = (1024 * scale) / 100;
  const offset = (1024 - 1024 * scale) / 2;
  const bg = background ? `<rect width="1024" height="1024" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg}<g transform="translate(${offset} ${offset}) scale(${s})">${mark(color)}</g></svg>`;
};

const variants = {
  'icon-light': { color: CYAN, background: '#FFFFFF', scale: 0.62 },
  // iOS dark icons use a transparent background; the system draws the dark backdrop.
  'icon-dark': { color: PURPLE, scale: 0.62 },
  // iOS tinted icons are greyscale; the system applies the user's tint.
  'icon-tinted': { color: '#FFFFFF', scale: 0.62 },
  'android-icon-foreground': { color: CYAN, scale: 0.46 },
  'android-icon-monochrome': { color: '#FFFFFF', scale: 0.46 },
  'android-icon-background': { color: 'none', background: '#FFFFFF', scale: 0 },
  // Previews / store listing
  'preview-light': { color: CYAN, background: '#FFFFFF', scale: 0.62 },
  'preview-dark': { color: PURPLE, background: '#000000', scale: 0.62 },
};

// Alternate icons users can pick in Settings (Pro). Colours match ICONS in src/lib/palette.ts;
// the default icon (cyan light / purple dark) is icon-light / icon-dark above.
const ALTERNATES = {
  cyan: { light: '#0AA5C2', dark: '#22D3EE' },
  violet: { light: '#7C3AED', dark: '#A78BFA' },
  ocean: { light: '#2563EB', dark: '#60A5FA' },
  emerald: { light: '#059669', dark: '#34D399' },
  rose: { light: '#E11D48', dark: '#FB7185' },
  amber: { light: '#A16207', dark: '#FACC15' },
  orange: { light: '#EA580C', dark: '#FB923C' },
  mono: { light: '#18181B', dark: '#F4F4F5' },
};
for (const [id, c] of Object.entries(ALTERNATES)) {
  variants[`alt-${id}-light`] = { color: c.light, background: '#FFFFFF', scale: 0.62 };
  variants[`alt-${id}-dark`] = { color: c.dark, scale: 0.62 };
  variants[`alt-${id}-foreground`] = { color: c.light, scale: 0.46 };
}

const out = process.argv[2] ?? '.';
fs.mkdirSync(out, { recursive: true });
for (const [name, v] of Object.entries(variants)) {
  fs.writeFileSync(path.join(out, `${name}.svg`), icon(v));
}
console.log(`wrote ${Object.keys(variants).length} SVGs to ${out}`);
