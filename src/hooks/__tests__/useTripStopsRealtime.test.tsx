// The planner and trip details rely on this hook to show stop changes made on other phones. One add
// arrives as a burst of row events, so these also pin that a burst reloads once

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { mockChannels, mockSupabase } from '@/src/test/supabase';
import { STOP_CHANGES_SETTLE_MS, useTripStopsRealtime } from '../useTripStopsRealtime';

const added = { eventType: 'INSERT', new: { id: 4, trip_id: 7 }, old: {} };
const shifted = (id: number) => ({ eventType: 'UPDATE', new: { id, trip_id: 7 }, old: { id } });
const removed = { eventType: 'DELETE', new: {}, old: { id: 4 } };

let reload: jest.Mock<() => void>;

beforeEach(() => {
  jest.useFakeTimers();
  reload = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useTripStopsRealtime', () => {
  it('reloads once a stop change has settled', async () => {
    await renderHook(() => useTripStopsRealtime(7, reload));

    await act(async () => mockChannels()[0].__emit(removed));
    expect(reload).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(STOP_CHANGES_SETTLE_MS));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads once for an add that shifts the stops after it', async () => {
    await renderHook(() => useTripStopsRealtime(7, reload));
    const [channel] = mockChannels();

    await act(async () => {
      channel.__emit(shifted(2));
      channel.__emit(shifted(3));
      channel.__emit(added);
      jest.advanceTimersByTime(STOP_CHANGES_SETTLE_MS);
    });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for a later, separate change', async () => {
    await renderHook(() => useTripStopsRealtime(7, reload));
    const [channel] = mockChannels();

    await act(async () => {
      channel.__emit(added);
      jest.advanceTimersByTime(STOP_CHANGES_SETTLE_MS);
      channel.__emit(removed);
      jest.advanceTimersByTime(STOP_CHANGES_SETTLE_MS);
    });

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('closes its channel and drops a pending reload on unmount', async () => {
    const { unmount } = await renderHook(() => useTripStopsRealtime(7, reload));
    const [channel] = mockChannels();

    await act(async () => channel.__emit(added));
    await act(async () => unmount());
    await act(async () => jest.advanceTimersByTime(STOP_CHANGES_SETTLE_MS));

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel);
    expect(mockChannels()).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('opens nothing for an id that is not a number', async () => {
    await renderHook(() => useTripStopsRealtime(NaN, reload));

    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });
});
