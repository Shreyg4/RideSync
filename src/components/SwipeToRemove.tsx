/**
 * @file SwipeToRemove.tsx
 * @description Wraps a list row so swiping it left reveals a red trash button that removes it.
 * Swiping back closes it again. The screen decides what a tap elsewhere does, through onOpen/onClose
 */
import { Trash2 } from 'lucide-react-native';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { haptics } from '@/src/constants/haptics';
import { colors, radii, spacing } from '@/src/constants/theme';

const BUTTON_SIZE = 44;
// The button and the gap between it and the row
const ACTION_WIDTH = BUTTON_SIZE + spacing.md;

type SwipeToRemoveProps = {
  children: ReactNode;
  removeLabel: string; // what a screen reader says for the trash button
  onRemove: () => void;
  removing?: boolean; // shows a spinner on the button and stops a second press
  onOpen?: (methods: SwipeableMethods) => void;
  onClose?: () => void;
  onTouchStart?: () => void; // runs before the screen's own touch handler sees the touch
  testID?: string;
};

const SwipeToRemove = ({
  children,
  removeLabel,
  onRemove,
  removing = false,
  onOpen,
  onClose,
  onTouchStart,
  testID,
}: SwipeToRemoveProps) => {
  const swipeable = useRef<SwipeableMethods | null>(null);

  return (
    <View onTouchStart={onTouchStart}>
      <ReanimatedSwipeable
        ref={swipeable}
        friction={2}
        // Past halfway the row snaps open, short of it the row springs back
        rightThreshold={ACTION_WIDTH / 2}
        overshootRight={false}
        onSwipeableWillOpen={() => {
          if (swipeable.current) onOpen?.(swipeable.current);
        }}
        onSwipeableWillClose={() => onClose?.()}
        renderRightActions={() => (
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                haptics.destructive();
                onRemove();
              }}
              disabled={removing}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={removeLabel}
              accessibilityState={{ disabled: removing, busy: removing }}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              testID={testID ? `${testID}-remove` : undefined}
            >
              {removing ? (
                <ActivityIndicator color={colors.textOnTint} />
              ) : (
                <Trash2 color={colors.textOnTint} size={22} />
              )}
            </Pressable>
          </View>
        )}
        testID={testID}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
};

export default SwipeToRemove;

const styles = StyleSheet.create({
  actions: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
