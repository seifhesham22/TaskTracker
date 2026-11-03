/**
 * Design tokens from the designer handoff (styles.css, shadcn/ui neutral theme).
 * Names follow the CSS variables, e.g. `--muted-foreground` -> `colors.mutedForeground`.
 */
export const colors = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  card: '#FFFFFF',
  primary: '#171717',
  primaryForeground: '#FAFAFA',
  muted: '#F5F5F5',
  mutedForeground: '#636363',
  destructive: '#E7000B',
  destructiveTint: 'rgba(231,0,11,0.1)',
  destructiveBorder: 'rgba(231,0,11,0.35)',
  alertBackground: '#FFFAFA',
  border: '#E5E5E5',
  input: '#E5E5E5',
  ring: '#A1A1A1',
  skeleton: '#EBEBEB',
  overlay: 'rgba(0,0,0,0.5)',
  priority: {
    LOW: { bg: '#F5F5F5', fg: '#404040', border: '#E5E5E5' },
    MEDIUM: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
    HIGH: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
    CRITICAL: { bg: '#C10007', fg: '#FFFFFF', border: '#C10007' },
  },
  status: {
    BACKLOG: '#8A90A0',
    TO_DO: '#5B8DE8',
    IN_PROGRESS: '#E8945B',
    DONE: '#2A9D8F',
    CANCELLED: '#636363',
  },
} as const;

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 } as const;

/** Minimum touch target from the mobile design (44 pt). */
export const touchTarget = 44;

export const text = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
} as const;
