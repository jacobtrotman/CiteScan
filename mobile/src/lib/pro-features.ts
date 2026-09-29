import type Ionicons from '@expo/vector-icons/Ionicons';

/** What CiteScan Pro includes. Shown on the paywall and the "You're Pro" screen. */
export const PRO_FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: 'infinite', title: 'Unlimited essay checks', detail: 'Check every draft, as often as you like.' },
  {
    icon: 'globe-outline',
    title: 'Advanced search',
    detail: 'Also searches news, reports and official statistics, not just academic papers.',
  },
  {
    icon: 'time-outline',
    title: 'Full history',
    detail: 'Open and search every essay you’ve checked, not just the last 7 days.',
  },
  { icon: 'color-palette-outline', title: 'Your own colours', detail: 'Pick an accent colour and background theme.' },
  { icon: 'apps-outline', title: 'Custom app icon', detail: 'Choose the CiteScan icon on your home screen.' },
];
