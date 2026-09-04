import palette from './palette';
import type { TextStyle } from 'react-native';
import type { DimensionValue } from 'react-native';

export { palette };

export const colors = {
  tint: palette.blue5, //Primary Color
  tintDark: palette.blue2,
  tintPressed: palette.blue3,
  tintMid: palette.blue6,
  tintSubtle: palette.blue7,

  background: palette.black,
  card: palette.gray900,
  border: palette.gray700,
  disabled: palette.blue2,

  text: palette.white,
  textMuted: palette.gray500,
  textMutedLight: palette.gray300,
  textOnTint: palette.white,

  tabIconDefault: palette.gray500,
  tabIconSelected: palette.blue5,
  error: palette.red,
  success: palette.green,
};

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
  xxl: 50,
} as const;

export const radii = {
  sm: 10,
  md: 15,
  lg: 20,
  xl: 25,
  pill: 999,
} as const;

export const gradients = {
  cardToBackground: {
    colors: [colors.card, colors.background] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0.7 },
  },
  topFade: {
    colors: [colors.background, colors.background, 'transparent'] as const,
    locations: [0, 0, 1] as const,
  },
  imageScrim: {
    colors: ['transparent', 'transparent', 'rgba(0, 0, 0, 1)'] as const,
    locations: [0, 0.5, 0.85] as const,
  },
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const fontSize = {
  caption: 15,
  body: 18,
  section: 20,
  sheetTitle: 30,
  screenTitle: 40,
} as const;

export const typography = {
  screenTitle: { fontSize: fontSize.screenTitle, fontWeight: fontWeight.heavy },
  sheetTitle: { fontSize: fontSize.sheetTitle, fontWeight: fontWeight.semibold },
  sectionTitle: { fontSize: fontSize.section, fontWeight: fontWeight.semibold },
  body: { fontSize: fontSize.body, fontWeight: fontWeight.regular },
  caption: { fontSize: fontSize.caption, fontWeight: fontWeight.regular },
} as const satisfies Record<string, TextStyle>;

export const contentWidth: DimensionValue = '95%';

export const tabBarHeight = 60;