import type { TextStyle } from 'react-native';

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
