/**
 * Design system color tokens as JS constants.
 * Used for Recharts theming and dynamic styles.
 */

export const COLORS = {
  gold: '#c9a84c',
  goldLight: '#d4b35e',
  goldDark: '#a88a3d',
  silver: '#c8c8d0',
  silverDark: '#88889a',
  positive: '#4ade80',
  negative: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
  bgPrimary: '#0a0a0f',
  bgCard: '#12121a',
  textPrimary: '#f0f0f5',
  textSecondary: '#9a9aaa',
  textMuted: '#5a5a6e',
  glassBg: 'rgba(18, 18, 26, 0.85)',
  glassBorder: 'rgba(200, 200, 208, 0.08)',
};

/** Chart-specific palette for Recharts fills/strokes */
export const CHART_COLORS = {
  primary: COLORS.gold,
  secondary: COLORS.silver,
  positive: COLORS.positive,
  negative: COLORS.negative,
  series: [
    COLORS.gold,
    COLORS.silver,
    COLORS.positive,
    COLORS.info,
    COLORS.warning,
    '#a78bfa',  // violet
    '#f472b6',  // pink
    '#34d399',  // emerald
    '#fb923c',  // orange
    '#38bdf8',  // sky
  ],
  grid: 'rgba(255, 255, 255, 0.04)',
  axis: COLORS.textMuted,
  tooltip: {
    bg: COLORS.glassBg,
    border: COLORS.glassBorder,
    text: COLORS.textPrimary,
    label: COLORS.textSecondary,
  },
};

/** Expectation-specific colors */
export const EXPECTATION_COLORS = {
  positive: COLORS.positive,
  negative: COLORS.negative,
  positiveSoft: 'rgba(74, 222, 128, 0.12)',
  negativeSoft: 'rgba(248, 113, 113, 0.12)',
};
