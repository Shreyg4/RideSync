// Refreshing should follow the foreground exactly: a ticker left running in the background
// wastes battery, and one that never restarts lets the access token expire mid-use.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { AppSupabaseClient } from '../createSupabaseClient';
import { registerSessionAutoRefresh } from '../sessionAutoRefresh';

const auth = { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
const client = { auth } as unknown as AppSupabaseClient;

const remove = jest.fn();
let onChange: (status: AppStateStatus) => void;

// React Native's jest preset leaves AppState.currentState as a bare mock, so each test sets it
const startIn = (status: AppStateStatus) => {
  (AppState as unknown as { currentState: AppStateStatus }).currentState = status;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onChange = listener;
    return { remove };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('registerSessionAutoRefresh', () => {
  it('starts refreshing straight away when the app opens in the foreground', () => {
    startIn('active');
    registerSessionAutoRefresh(client);

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
  });

  it.each<AppStateStatus>(['background', 'inactive', 'unknown'])(
    'stays paused when the app starts %s',
    (status) => {
      startIn(status);
      registerSessionAutoRefresh(client);

      expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
      expect(auth.startAutoRefresh).not.toHaveBeenCalled();
    }
  );

  it('listens for app state changes once', () => {
    startIn('active');
    registerSessionAutoRefresh(client);

    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('resumes refreshing when the app comes back to the foreground', () => {
    startIn('background');
    registerSessionAutoRefresh(client);

    onChange('active');

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it.each<AppStateStatus>(['background', 'inactive'])(
    'pauses refreshing when the app goes %s',
    (status) => {
      startIn('active');
      registerSessionAutoRefresh(client);

      onChange(status);

      expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    }
  );

  it('stops listening on teardown', () => {
    startIn('active');
    const teardown = registerSessionAutoRefresh(client);
    expect(remove).not.toHaveBeenCalled();

    teardown();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does nothing on web, where there is no app state to follow', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    startIn('active');

    const teardown = registerSessionAutoRefresh(client);

    expect(AppState.addEventListener).not.toHaveBeenCalled();
    expect(auth.startAutoRefresh).not.toHaveBeenCalled();
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled();
    expect(() => teardown()).not.toThrow();
  });
});
