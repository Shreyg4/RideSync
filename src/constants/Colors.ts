const palette = {
  blue1: '#08121F', 
  blue2: '#082444',
  blue3: '#073C75',
  blue4: '#225B9F',
  blue5: '#1B8AFF', //Primary Color
  blue6: '#75B7FF',
  blue7: '#CAE3FF',

  black:   '#000',
  gray900: '#121213',
  gray700: '#272729',
  gray500: '#47474B', 
  gray300: '#7B7B80',
  white:   '#FFF',

  blur: 'rgba: (0, 0, 0, 0.8)'
};

export default {
  theme: {
    // brand
    tint: palette.blue5,
    tintPressed: palette.blue3,
    tintSubtle: palette.blue7,

    // surfaces
    background: palette.black,
    blur: palette.blur,
    card: palette.gray900,
    border: palette.gray700,

    // text
    text: palette.white,
    textMuted: palette.gray500,
    textMutedLight: palette.gray300,
    textOnTint: palette.white,

    // status
    tabIconDefault: palette.gray500,
    tabIconSelected: palette.blue5,
  },
};