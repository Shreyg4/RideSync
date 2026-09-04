/**
 * @file haptics.ts
 * @description Handles all haptic calls in one file making haptic customization easy.
 */
import * as Haptics from 'expo-haptics';

// 'selection' is the lightest tap
export type HapticRole = 'selection' | 'action' | 'destructive';

export const haptics: Record<HapticRole, () => void> = {
  selection: () => {
    Haptics.selectionAsync();
  },
  action: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  destructive: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
};
