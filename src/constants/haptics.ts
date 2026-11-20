/**
 * @file haptics.ts
 * @description Handles all haptic calls in one file making haptic customization easy.
 */
import * as Haptics from 'expo-haptics';

// 'selection' is the lightest tap
// 'warning' says something wasn't allowed, like a stop dropped where it can't go
export type HapticRole = 'selection' | 'action' | 'destructive' | 'warning';

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
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
