// Theme constants exported as CSS variable references.
// All color values come from index.css's CSS custom properties,
// which swap automatically when [data-theme="dark"] is set on <html>.

export const colors = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-light)',
  primaryDark: 'var(--color-primary-dark)',

  accent: 'var(--color-accent)',
  accentDark: 'var(--color-accent-dark)',

  risk: {
    HIGH: 'var(--color-risk-high)',
    MODERATE: 'var(--color-risk-moderate)',
    LOW: 'var(--color-risk-low)',
    NONE: 'var(--color-risk-none)',
  },

  bg: 'var(--color-bg)',
  bgCard: 'var(--color-bg-card)',
  bgSubtle: 'var(--color-bg-subtle)',

  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
  textLight: 'var(--color-text-light)',

  border: 'var(--color-border)',
  borderLight: 'var(--color-border-light)',

  white: '#ffffff',
  whiteMuted: 'rgba(255, 255, 255, 0.85)',
};

export const fonts = {
  sans: '"Inter", system-ui, -apple-system, sans-serif',
  display: '"Playfair Display", Georgia, serif',
  mono: '"SF Mono", Menlo, Consolas, monospace',
};

export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: '0 25px 50px rgba(0,0,0,0.12)',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const transitions = {
  fast: 'all 0.15s ease',
  base: 'all 0.2s ease',
  slow: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
};

export function riskColor(category) {
  return colors.risk[category] || colors.risk.NONE;
}

export const tabularNums = {
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};