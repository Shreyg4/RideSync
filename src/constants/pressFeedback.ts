import type { ViewStyle } from 'react-native';

export const pressFeedback = {
  control: (pressed: boolean): ViewStyle => ({ opacity: pressed ? 0.6 : 1 }),
  card: (pressed: boolean): ViewStyle => ({
    transform: [{ scale: pressed ? 0.95 : 1 }],
    opacity: pressed ? 0.85 : 1,
  }),
} as const;
