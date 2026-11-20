/**
 * @file DragHandle.tsx
 * @description The grip on a row of a ReorderableList. Holding it for a moment picks the row up,
 * and moving the finger drags it. A quick tap does nothing. Only the handle starts a drag, so the
 * rest of the row can still be tapped, swiped and scrolled. Must be rendered inside a
 * ReorderableList's row
 */
import { GripVertical } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { haptics } from '@/src/constants/haptics';
import { colors } from '@/src/constants/theme';

// Long enough that a tap doesn't pick the row up, short enough that a hold feels immediate. The
// drag has to start while the finger is still down: the list ends a drag when the finger lifts,
// and a drag started after that would never end
const HOLD_TO_DRAG_MS = 150;

type DragHandleProps = {
  label: string; // what a screen reader says for the handle
  disabled?: boolean; // while an earlier move is still saving
  testID?: string;
};

const DragHandle = ({ label, disabled = false, testID }: DragHandleProps) => {
  const drag = useReorderableDrag();

  return (
    <Pressable
      onLongPress={() => {
        if (disabled) return;
        haptics.selection();
        drag();
      }}
      delayLongPress={HOLD_TO_DRAG_MS}
      // A tap on the grip does nothing, rather than opening the stop behind it
      onPress={() => {}}
      disabled={disabled}
      hitSlop={12}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={disabled && styles.disabled}
      testID={testID}
    >
      <GripVertical color={colors.textMutedLight} size={22} />
    </Pressable>
  );
};

export default DragHandle;

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.4,
  },
});
