import { useColorScheme } from 'react-native';

// Neutral palette matching the website (shadcn neutral), plus clear status colours.
// Sizes are deliberately large: many users are not comfortable with apps.

const light = {
  background: '#fafafa',
  card: '#ffffff',
  text: '#0a0a0a',
  muted: '#525252',
  border: '#d4d4d4',
  primary: '#171717',
  primaryText: '#fafafa',
  secondary: '#f0f0f0',
  secondaryText: '#171717',
  danger: '#b91c1c',
  dangerText: '#ffffff',
  success: '#15803d',
  successBg: '#dcfce7',
  warning: '#a16207',
  warningBg: '#fef9c3',
  info: '#1d4ed8',
  infoBg: '#dbeafe',
  errorBg: '#fee2e2',
  focus: '#2563eb',
};

const dark: typeof light = {
  background: '#0a0a0a',
  card: '#171717',
  text: '#fafafa',
  muted: '#a3a3a3',
  border: '#404040',
  primary: '#fafafa',
  primaryText: '#0a0a0a',
  secondary: '#262626',
  secondaryText: '#fafafa',
  danger: '#ef4444',
  dangerText: '#0a0a0a',
  success: '#4ade80',
  successBg: '#14532d',
  warning: '#facc15',
  warningBg: '#422006',
  info: '#93c5fd',
  infoBg: '#172554',
  errorBg: '#450a0a',
  focus: '#60a5fa',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { md: 10, lg: 14, pill: 999 };
export const font = { small: 15, body: 18, large: 20, title: 26, huge: 32 };
/** Minimum height for anything tappable. */
export const touchHeight = 56;
