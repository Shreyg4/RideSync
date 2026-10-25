// Every screen that loads data goes through useAsync, so these pin the three states it exposes
// and that a response which no longer matters never overwrites one that does.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { setErrorReporter } from '@/src/lib/logger';
import { useAsync } from '../useAsync';

const SCOPE = 'TestScreen.load';
const failure = { code: '42501', message: 'permission denied for table trips' };
const FRIENDLY = 'You do not have permission to do that.';

// A promise the test settles by hand, to look at the hook while the request is in flight
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let reporter: jest.Mock;

beforeEach(() => {
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setErrorReporter(null);
});

describe('useAsync', () => {
  it('starts out loading, then holds the data', async () => {
    const request = deferred<string>();
    const { result } = await renderHook(() => useAsync(() => request.promise, [], SCOPE));

    expect(result.current).toMatchObject({ data: null, loading: true, error: null });

    await act(async () => request.resolve('trips'));

    expect(result.current).toMatchObject({ data: 'trips', loading: false, error: null });
  });

  it('shows the friendly message, not the raw error, and reports it under its scope', async () => {
    const { result } = await renderHook(() => useAsync(() => Promise.reject(failure), [], SCOPE));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({ data: null, error: FRIENDLY });
    expect(reporter).toHaveBeenCalledWith(failure, { scope: SCOPE });
  });

  it('runs again on reload, clearing the old error while it loads', async () => {
    const retry = deferred<string>();
    const run = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockReturnValueOnce(retry.promise);
    const { result } = await renderHook(() => useAsync(run, [], SCOPE));
    await waitFor(() => expect(result.current.error).toBe(FRIENDLY));

    await act(async () => result.current.reload());

    expect(result.current).toMatchObject({ loading: true, error: null });

    await act(async () => retry.resolve('trips'));

    expect(result.current).toMatchObject({ data: 'trips', loading: false, error: null });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the last data while it reloads', async () => {
    const retry = deferred<string>();
    const run = jest
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('trips')
      .mockReturnValueOnce(retry.promise);
    const { result } = await renderHook(() => useAsync(run, [], SCOPE));
    await waitFor(() => expect(result.current.data).toBe('trips'));

    await act(async () => result.current.reload());

    expect(result.current).toMatchObject({ data: 'trips', loading: true });
  });

  it('keeps reload the same function across renders, so effects that depend on it do not loop', async () => {
    const { result, rerender } = await renderHook(() =>
      useAsync(() => Promise.resolve('trips'), [], SCOPE)
    );
    const firstReload = result.current.reload;

    await rerender({});

    expect(result.current.reload).toBe(firstReload);
  });

  it('runs again when a dependency changes, and only then', async () => {
    const run = jest.fn(async (id: number) => `trip ${id}`);
    const { result, rerender } = await renderHook(
      ({ id }: { id: number }) => useAsync(() => run(id), [id], SCOPE),
      { initialProps: { id: 1 } }
    );
    await waitFor(() => expect(result.current.data).toBe('trip 1'));

    await rerender({ id: 1 });
    expect(run).toHaveBeenCalledTimes(1);

    await rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe('trip 2'));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('ignores a response for old dependencies that arrives after the current one', async () => {
    const forTrip1 = deferred<string>();
    const forTrip2 = deferred<string>();
    const { result, rerender } = await renderHook(
      ({ id }: { id: number }) =>
        useAsync(() => (id === 1 ? forTrip1.promise : forTrip2.promise), [id], SCOPE),
      { initialProps: { id: 1 } }
    );
    await rerender({ id: 2 });

    await act(async () => forTrip2.resolve('trip 2'));
    await act(async () => forTrip1.resolve('trip 1'));

    expect(result.current.data).toBe('trip 2');
  });

  it('neither shows nor reports a failure for old dependencies', async () => {
    const forTrip1 = deferred<string>();
    const { result, rerender } = await renderHook(
      ({ id }: { id: number }) =>
        useAsync(() => (id === 1 ? forTrip1.promise : Promise.resolve('trip 2')), [id], SCOPE),
      { initialProps: { id: 1 } }
    );
    await rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe('trip 2'));

    await act(async () => forTrip1.reject(failure));

    expect(result.current.error).toBeNull();
    expect(reporter).not.toHaveBeenCalled();
  });

  it('drops a failure that lands after unmount, without reporting it', async () => {
    const request = deferred<string>();
    const { unmount } = await renderHook(() => useAsync(() => request.promise, [], SCOPE));

    await unmount();
    await act(async () => request.reject(failure));

    expect(reporter).not.toHaveBeenCalled();
  });
});
