// Trip screens rely on this hook to show member changes made on other phones, so these pin when it
// reloads, when it hands off to onRemoved instead, and that it closes its channel on the way out.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { AuthContext } from '@/src/context/AuthProvider';
import { signedInAuth } from '@/src/test/render';
import { mockChannels, mockSupabase } from '@/src/test/supabase';
import { useTripMembersRealtime } from '../useTripMembersRealtime';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={signedInAuth()}>{children}</AuthContext.Provider>
);

const joined = (userId: string) => ({ eventType: 'INSERT', new: { user_id: userId }, old: {} });
const removed = (userId: string) => ({ eventType: 'DELETE', new: {}, old: { user_id: userId } });

let reload: jest.Mock<() => void>;
let onRemoved: jest.Mock<() => void>;

beforeEach(() => {
  reload = jest.fn();
  onRemoved = jest.fn();
});

describe('useTripMembersRealtime', () => {
  it('reloads when someone else joins or is removed', async () => {
    await renderHook(() => useTripMembersRealtime(7, reload, onRemoved), { wrapper });
    const [channel] = mockChannels();

    await act(async () => channel.__emit(joined('user-2')));
    await act(async () => channel.__emit(removed('user-2')));

    expect(reload).toHaveBeenCalledTimes(2);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('calls onRemoved instead of reloading when the signed-in user is taken off the trip', async () => {
    await renderHook(() => useTripMembersRealtime(7, reload, onRemoved), { wrapper });

    await act(async () => mockChannels()[0].__emit(removed('user-1')));

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('just reloads on its own removal when there is no onRemoved', async () => {
    await renderHook(() => useTripMembersRealtime(7, reload), { wrapper });

    await act(async () => mockChannels()[0].__emit(removed('user-1')));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('closes its channel on unmount', async () => {
    const { unmount } = await renderHook(() => useTripMembersRealtime(7, reload), { wrapper });
    const [channel] = mockChannels();

    await act(async () => unmount());

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel);
    expect(mockChannels()).toHaveLength(0);
  });

  it('opens nothing for an id that is not a number', async () => {
    await renderHook(() => useTripMembersRealtime(NaN, reload), { wrapper });

    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });
});
