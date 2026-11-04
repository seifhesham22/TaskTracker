import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

const LUCIDE = {
  plus: (
    <>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </>
  ),
  calendar: (
    <>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
    </>
  ),
  user: (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  'triangle-alert': (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </>
  ),
  'circle-alert': (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" x2="12" y1="8" y2="12" />
      <Line x1="12" x2="12.01" y1="16" y2="16" />
    </>
  ),
  'refresh-cw': (
    <>
      <Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <Path d="M21 3v5h-5" />
      <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <Path d="M8 16H3v5" />
    </>
  ),
  'chevron-down': <Path d="m6 9 6 6 6-6" />,
  'chevron-left': <Path d="m15 18-6-6 6-6" />,
  x: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  'search-x': (
    <>
      <Path d="m13.5 8.5-5 5" />
      <Path d="m8.5 8.5 5 5" />
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  'clipboard-list': (
    <>
      <Rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M12 11h4" />
      <Path d="M12 16h4" />
      <Path d="M8 11h.01" />
      <Path d="M8 16h.01" />
    </>
  ),
  'arrow-left': (
    <>
      <Path d="m12 19-7-7 7-7" />
      <Path d="M19 12H5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof LUCIDE;

export function Icon({ name, size = 16, color = colors.foreground }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {LUCIDE[name]}
    </Svg>
  );
}
