import Svg, { Circle, Path, Rect } from 'react-native-svg';

// The CiteScan mark: a graduation cap inside a scanner frame, drawn on a 100x100 grid.
// Keep in sync with scripts/make-icons.mjs (the app icons).
export const FRAME_PATH =
  'M10 30V18Q10 10 18 10H30 M70 10H82Q90 10 90 18V30 M90 70V82Q90 90 82 90H70 M30 90H18Q10 90 10 82V70';
export const BOARD_PATH = 'M50 30L80 44L50 58L20 44Z';
export const BAND_PATH = 'M33 52.5L50 60.5L67 52.5V63Q50 71 33 63Z';

export function LogoMark({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={FRAME_PATH} stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d={BAND_PATH} fill={color} />
      <Path d={BOARD_PATH} fill={color} />
      <Path d="M74 46.8V61" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={74} cy={63} r={2.8} fill={color} />
      <Rect x={71.8} y={64.5} width={4.4} height={9} rx={1.5} fill={color} />
    </Svg>
  );
}
