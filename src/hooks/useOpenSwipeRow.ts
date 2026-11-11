/**
 * @file useOpenSwipeRow.ts
 * @description Keeps at most one swiped-open row in a list. Opening a row closes the last one, and a
 * tap anywhere outside the open row closes it without also doing what was tapped
 */
import { useCallback, useRef } from 'react';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

type OpenRow = { id: number; methods: SwipeableMethods };

export const useOpenSwipeRow = () => {
  const open = useRef<OpenRow | null>(null);
  // Touches reach the row's handler before the screen's, so the screen can tell where a touch began
  const touchedRowId = useRef<number | null>(null);
  // The tap that closed a row only closes it, so the button or card under it mustn't act on release
  const closedThisTap = useRef(false);

  const closeOpenRow = useCallback(() => {
    open.current?.methods.close();
    open.current = null;
  }, []);

  const onRowOpen = useCallback((id: number, methods: SwipeableMethods) => {
    if (open.current && open.current.id !== id) open.current.methods.close();
    open.current = { id, methods };
  }, []);

  const onRowClose = useCallback((id: number) => {
    if (open.current?.id === id) open.current = null;
  }, []);

  const onRowTouch = useCallback((id: number) => {
    touchedRowId.current = id;
  }, []);

  // Goes on the screen's outermost view, as its onTouchStart
  const onScreenTouch = useCallback(() => {
    const touched = touchedRowId.current;
    touchedRowId.current = null;
    closedThisTap.current = false;
    if (!open.current || touched === open.current.id) return;
    closeOpenRow();
    closedThisTap.current = true;
  }, [closeOpenRow]);

  // Wraps a list action, like opening a stop, so it doesn't run on the tap that closed a row. A tap on
  // the open row's own card closes that row instead of opening it
  const unlessClosing = useCallback(
    <Args extends unknown[]>(action: (...args: Args) => void) =>
      (...args: Args) => {
        if (closedThisTap.current) {
          closedThisTap.current = false;
          return;
        }
        if (open.current) {
          closeOpenRow();
          return;
        }
        action(...args);
      },
    [closeOpenRow]
  );

  return { onRowOpen, onRowClose, onRowTouch, onScreenTouch, unlessClosing, closeOpenRow };
};
