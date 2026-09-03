import * as Haptics from 'expo-haptics';

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
