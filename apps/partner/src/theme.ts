import { useColorScheme } from 'react-native';

// Black-and-white, matching the website's ink-on-paper look: warm off-white paper with film
// grain, near-black ink, hairline borders. Red is kept only for destructive actions and errors,
// where colour carries meaning; booking states are told apart by fill and outline instead.
// Sizes are deliberately large: many users are not comfortable with apps.

const light = {
  background: '#f3f2ee',
  card: '#ffffff',
  text: '#0d0d0d',
  muted: '#5b5b58',
  border: '#d8d6d0',
  /** Strong rule: section dividers, focused fields, selected items. */
  ink: '#0d0d0d',
  primary: '#0d0d0d',
  primaryText: '#ffffff',
  secondary: '#e9e7e1',
  secondaryText: '#0d0d0d',
  danger: '#b42318',
  dangerText: '#ffffff',
  success: '#0d0d0d',
  successBg: '#e4e2dc',
  warning: '#0d0d0d',
  warningBg: '#ffffff',
  info: '#ffffff',
  infoBg: '#0d0d0d',
  errorBg: '#fbe9e7',
  focus: '#0d0d0d',
  /** The black chrome: tab bar and the login cover. */
  chrome: '#0d0d0d',
  chromeText: '#ffffff',
  chromeMuted: '#8a8a86',
};

const dark: typeof light = {
  background: '#0b0b0b',
  card: '#151515',
  text: '#f3f2ee',
  muted: '#9b9a96',
  border: '#2c2c2b',
  ink: '#f3f2ee',
  primary: '#f3f2ee',
  primaryText: '#0b0b0b',
  secondary: '#222221',
  secondaryText: '#f3f2ee',
  danger: '#f97066',
  dangerText: '#0b0b0b',
  success: '#f3f2ee',
  successBg: '#262625',
  warning: '#f3f2ee',
  warningBg: '#0b0b0b',
  info: '#0b0b0b',
  infoBg: '#f3f2ee',
  errorBg: '#3a1714',
  focus: '#f3f2ee',
  chrome: '#000000',
  chromeText: '#f3f2ee',
  chromeMuted: '#77766f',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { md: 14, lg: 22, pill: 999 };
export const font = { small: 15, body: 18, large: 20, title: 26, huge: 32 };
/** Minimum height for anything tappable. */
export const touchHeight = 56;

/**
 * Font families, loaded in app/_layout.tsx. Unbounded is the wide display face (titles, labels,
 * the wordmark); Newsreader is the editorial serif for everything people read. Custom fonts ignore
 * fontWeight on Android, so pick the family for the weight instead.
 */
export const fonts = {
  display: 'Unbounded_600SemiBold',
  displayBold: 'Unbounded_700Bold',
  serif: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
};

/** Tileable film grain, laid over paper (dark specks) and black chrome (light specks). */
export const grain = {
  dark: require('../assets/images/grain-dark.png'),
  light: require('../assets/images/grain-light.png'),
};
