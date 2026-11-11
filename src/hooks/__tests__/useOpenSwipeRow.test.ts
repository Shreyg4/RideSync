import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useOpenSwipeRow } from '../useOpenSwipeRow';

const row = (): SwipeableMethods & { close: jest.Mock } => ({
  close: jest.fn(),
  openLeft: jest.fn(),
  openRight: jest.fn(),
  reset: jest.fn(),
});

const setup = async () => (await renderHook(() => useOpenSwipeRow())).result;

describe('useOpenSwipeRow', () => {
  it('closes the open row when another one opens', async () => {
    const result = await setup();
    const first = row();
    const second = row();

    await act(() => result.current.onRowOpen(1, first));
    await act(() => result.current.onRowOpen(2, second));

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
  });

  it('closes the open row on a touch that starts outside it, and skips the action under it', async () => {
    const result = await setup();
    const open = row();
    const action = jest.fn();
    await act(() => result.current.onRowOpen(1, open));

    await act(() => result.current.onScreenTouch());
    result.current.unlessClosing(action)();

    expect(open.close).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it('runs the action on the next tap once the row is closed', async () => {
    const result = await setup();
    const action = jest.fn();
    await act(() => result.current.onRowOpen(1, row()));
    await act(() => result.current.onScreenTouch());
    result.current.unlessClosing(action)();

    await act(() => result.current.onScreenTouch());
    result.current.unlessClosing(action)('again');

    expect(action).toHaveBeenCalledWith('again');
  });

  it('leaves the open row alone for a touch inside it, such as on its trash button', async () => {
    const result = await setup();
    const open = row();
    await act(() => result.current.onRowOpen(1, open));

    await act(() => {
      result.current.onRowTouch(1);
      result.current.onScreenTouch();
    });

    expect(open.close).not.toHaveBeenCalled();
  });

  it('closes the open row instead of running an action from inside it, like tapping its card', async () => {
    const result = await setup();
    const open = row();
    const action = jest.fn();
    await act(() => result.current.onRowOpen(1, open));

    await act(() => {
      result.current.onRowTouch(1);
      result.current.onScreenTouch();
    });
    result.current.unlessClosing(action)();

    expect(open.close).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it('forgets a row that swiped closed by itself', async () => {
    const result = await setup();
    const open = row();
    const action = jest.fn();
    await act(() => result.current.onRowOpen(1, open));
    await act(() => result.current.onRowClose(1));

    await act(() => result.current.onScreenTouch());
    result.current.unlessClosing(action)();

    expect(open.close).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs actions straight away when nothing is open', async () => {
    const result = await setup();
    const action = jest.fn();

    await act(() => result.current.onScreenTouch());
    result.current.unlessClosing(action)(5);

    expect(action).toHaveBeenCalledWith(5);
  });
});
