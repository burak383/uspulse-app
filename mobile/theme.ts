// Design tokens for the "UsPulse" app.
//
// NOTE: the original FireVibe export had every screen importing this file a
// different way (`import { theme } from './theme'` + `theme.colors`,
// `import { colors, fonts } from './theme'`, and `import theme from './theme'`
// as a default import) while this file only ever exported `Colors`/`Fonts`/
// `Theme`. None of those imports actually matched, so every single screen
// crashed immediately on load. This file now exports every shape every
// screen expects, so nothing needs to change on the screen side.

export const Colors = {
  background: '#34243A',
  foreground: '#FFF7F4',
  primary: '#FF8F82',
  primaryForeground: '#34243A',
  secondary: '#5A435D',
  secondaryForeground: '#FFF7F4',
  accent: '#F4C46B',
  accentForeground: '#34243A',
  muted: '#47334C',
  mutedForeground: '#DABFC8',
  card: '#432E47',
  cardForeground: '#FFF7F4',
  border: '#70566D',
  input: '#513B55',
  destructive: '#F4777B',
  destructiveForeground: '#34243A',
  success: '#9FCCA7',
  successForeground: '#22352B',
  chart1: '#FF8F82',
  chart2: '#F4C46B',
  chart3: '#9FCCA7',
  chart4: '#9CBCE8',
  chart5: '#D7A1D1',
} as const;

export const Fonts = {
  heading: 'Fraunces',
  body: 'Manrope',
} as const;

export const Theme = {
  cornerRadius: 20,
} as const;

// Lowercase aliases used by most screens (`import { colors, fonts } from './theme'`).
export const colors = Colors;
export const fonts = Fonts;
export const cornerRadius = Theme.cornerRadius;

// Namespaced object used by screens that do `import { theme } from './theme'`
// and then read `theme.colors` / `theme.fonts`.
export const theme = {
  colors,
  fonts,
  cornerRadius,
};

// Default export used by screens that do `import theme from './theme'`.
export default theme;
