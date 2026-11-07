// The search box calls Mapbox on every pause in typing, and Mapbox bills by session token. These pin
// when a request goes out, which token it carries, and that an old response can't replace a new one.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { setErrorReporter } from '@/src/lib/logger';
import { retrievePlace, suggestPlaces } from '@/src/services/mapboxSearchService';
import type { Coordinates, Place, PlaceSuggestion } from '@/src/types/trip';
import { usePlaceSearch } from '../usePlaceSearch';

jest.mock('@/src/services/mapboxSearchService', () => ({
  suggestPlaces: jest.fn(),
  retrievePlace: jest.fn(),
}));

let mockTokenCount = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `token-${++mockTokenCount}`,
}));

// Holds the screen's focus callback so a test can decide when the user comes back to it
let mockRefocus: () => void = () => {};
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    mockRefocus = effect;
  },
}));

const suggest = suggestPlaces as unknown as jest.Mock<
  (
    query: string,
    token: string,
    proximity: Coordinates | null,
    signal: AbortSignal
  ) => Promise<PlaceSuggestion[]>
>;
const retrieve = retrievePlace as unknown as jest.Mock<
  (id: string, token: string, signal: AbortSignal) => Promise<Place>
>;

const DEBOUNCE_MS = 300;
const NEEDLE: PlaceSuggestion = { mapboxId: 'needle', name: 'Space Needle', address: 'Seattle' };
const PLACE: Place = { ...NEEDLE, lat: 47.6, lng: -122.3, category: 'attraction' };

const setup = async (proximity: Coordinates | null = null) =>
  renderHook((props: { proximity: Coordinates | null }) => usePlaceSearch(props.proximity), {
    initialProps: { proximity },
  });

type Hook = Awaited<ReturnType<typeof setup>>;

const type = (hook: Hook, text: string) => act(async () => hook.result.current.setQuery(text));
const wait = (ms = DEBOUNCE_MS) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)));

const search = async (hook: Hook, text: string) => {
  await type(hook, text);
  await wait();
};

const pick = async (hook: Hook, id = NEEDLE.mapboxId) => {
  let picked: Place | null = null;
  await act(async () => {
    picked = await hook.result.current.pick(id);
  });
  return picked;
};

// A request a test can finish whenever it wants
const deferred = <T,>() => {
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
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockTokenCount = 0;
  reporter = jest.fn();
  setErrorReporter(reporter);
  suggest.mockResolvedValue([NEEDLE]);
  retrieve.mockResolvedValue(PLACE);
});

afterEach(() => {
  setErrorReporter(null);
  jest.useRealTimers();
});

describe('typing', () => {
  it('waits for a pause, then sends only the final text', async () => {
    const hook = await setup();

    await type(hook, 'Sp');
    await wait(DEBOUNCE_MS - 1);
    await type(hook, 'Space');
    await wait(DEBOUNCE_MS - 1);
    expect(suggest).not.toHaveBeenCalled();

    await wait(1);

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0][0]).toBe('Space');
    expect(hook.result.current.results).toEqual([NEEDLE]);
  });

  it('does not search text too short to mean anything, and clears the old results', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    suggest.mockClear();

    await search(hook, ' S ');

    expect(suggest).not.toHaveBeenCalled();
    expect(hook.result.current.results).toEqual([]);
  });

  it('does not search again when only surrounding spaces change', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    suggest.mockClear();

    await search(hook, 'Space ');

    expect(suggest).not.toHaveBeenCalled();
  });

  it('sends the location, and searches again when it arrives late', async () => {
    const hook = await setup(null);
    await search(hook, 'Space');
    expect(suggest.mock.calls[0][2]).toBeNull();

    const seattle = { lat: 47.6, lng: -122.3 };
    await hook.rerender({ proximity: seattle });
    await wait();

    expect(suggest).toHaveBeenCalledTimes(2);
    expect(suggest.mock.calls[1][2]).toBe(seattle);
    expect(suggest.mock.calls[1][1]).toBe(suggest.mock.calls[0][1]);
  });

  it('cancels the request in flight and ignores its late answer', async () => {
    const hook = await setup();
    const first = deferred<PlaceSuggestion[]>();
    suggest.mockReturnValueOnce(first.promise);
    await search(hook, 'Sp');

    await search(hook, 'Space');
    expect(suggest.mock.calls[0][3].aborted).toBe(true);

    const stale = { mapboxId: 'stale', name: 'Spa', address: null };
    await act(async () => first.resolve([stale]));

    expect(hook.result.current.results).toEqual([NEEDLE]);
  });

  it('shows searching until the answer arrives', async () => {
    const hook = await setup();
    const request = deferred<PlaceSuggestion[]>();
    suggest.mockReturnValueOnce(request.promise);

    await search(hook, 'Space');
    expect(hook.result.current.searching).toBe(true);

    await act(async () => request.resolve([NEEDLE]));
    expect(hook.result.current.searching).toBe(false);
  });

  it('only says there are no results once that exact text has come back empty', async () => {
    const hook = await setup();
    suggest.mockResolvedValue([]);

    await type(hook, 'zzzz');
    expect(hook.result.current.noResults).toBe(false);

    await wait();
    expect(hook.result.current.noResults).toBe(true);

    await type(hook, 'zzzzz');
    expect(hook.result.current.noResults).toBe(false);
  });

  it('reports a failed search and shows a friendly message, not a raw one', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    const failure = Object.assign(new Error('Mapbox search failed: 500'), {
      code: 'mapbox_search_failed',
    });
    suggest.mockRejectedValue(failure);

    await search(hook, 'Spaces');

    expect(hook.result.current.error).toBe(
      'Search is not available right now. Try again in a moment.'
    );
    expect(hook.result.current.results).toEqual([]);
    expect(hook.result.current.noResults).toBe(false);
    expect(hook.result.current.searching).toBe(false);
    expect(reporter).toHaveBeenCalledWith(failure, { scope: 'usePlaceSearch.suggest' });
  });

  it('does not report a request it cancelled itself', async () => {
    const hook = await setup();
    const first = deferred<PlaceSuggestion[]>();
    suggest.mockReturnValueOnce(first.promise);
    await search(hook, 'Sp');

    await search(hook, 'Space');
    await act(async () => first.reject(new Error('Aborted')));

    expect(hook.result.current.error).toBeNull();
    expect(reporter).not.toHaveBeenCalled();
  });

  it('clears the error when the text changes', async () => {
    const hook = await setup();
    suggest.mockRejectedValueOnce(new Error('offline'));
    await search(hook, 'Space');
    expect(hook.result.current.error).not.toBeNull();

    await type(hook, 'Spaces');

    expect(hook.result.current.error).toBeNull();
  });
});

describe('the session token', () => {
  it('stays the same from every /suggest through the /retrieve', async () => {
    const hook = await setup();
    await search(hook, 'Sp');
    await search(hook, 'Space');

    await pick(hook);

    const tokens = [suggest.mock.calls[0][1], suggest.mock.calls[1][1], retrieve.mock.calls[0][1]];
    expect(tokens).toEqual(['token-1', 'token-1', 'token-1']);
  });

  it('gets replaced when the user comes back after a pick, and the search reruns on it', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    await pick(hook);
    suggest.mockClear();

    await act(async () => mockRefocus());
    await wait();

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0][0]).toBe('Space');
    expect(suggest.mock.calls[0][1]).toBe('token-2');

    await pick(hook);
    expect(retrieve.mock.calls[1][1]).toBe('token-2');
  });

  it('starts no new session or search after a pick until the user comes back', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    suggest.mockClear();

    await pick(hook);
    await wait(DEBOUNCE_MS * 2);

    expect(suggest).not.toHaveBeenCalled();
    expect(mockTokenCount).toBe(1);
  });

  it('keeps the token when the screen regains focus without a pick', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    suggest.mockClear();

    await act(async () => mockRefocus());
    await wait();

    expect(mockTokenCount).toBe(1);
    expect(suggest).not.toHaveBeenCalled();
  });

  it('keeps the token after a failed retrieve, since that did not end the session', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    retrieve.mockRejectedValueOnce(new Error('offline'));
    await pick(hook);

    await act(async () => mockRefocus());
    await pick(hook);

    expect(retrieve.mock.calls[1][1]).toBe('token-1');
  });
});

describe('picking a result', () => {
  it('resolves to the place', async () => {
    const hook = await setup();
    await search(hook, 'Space');

    await expect(pick(hook)).resolves.toEqual(PLACE);
    expect(retrieve.mock.calls[0][0]).toBe(NEEDLE.mapboxId);
    expect(hook.result.current.pickingId).toBeNull();
  });

  it('marks which result is loading and ignores other taps meanwhile', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    const request = deferred<Place>();
    retrieve.mockReturnValueOnce(request.promise);

    let first: Promise<Place | null> = Promise.resolve(null);
    await act(async () => {
      first = hook.result.current.pick('needle');
    });
    expect(hook.result.current.pickingId).toBe('needle');

    await expect(pick(hook, 'other')).resolves.toBeNull();
    expect(retrieve).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve(PLACE));
    await expect(first).resolves.toEqual(PLACE);
  });

  it('drops a search still waiting to send, so it cannot reuse the ended session', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    suggest.mockClear();
    await type(hook, 'Space N');

    await pick(hook);
    await wait();

    expect(suggest).not.toHaveBeenCalled();
    expect(hook.result.current.searching).toBe(false);
  });

  it('keeps the results and shows a friendly message when retrieve fails', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    const failure = new Error('offline');
    retrieve.mockRejectedValueOnce(failure);

    await expect(pick(hook)).resolves.toBeNull();

    expect(hook.result.current.error).toBe('Something went wrong. Please try again.');
    expect(hook.result.current.results).toEqual([NEEDLE]);
    expect(hook.result.current.pickingId).toBeNull();
    expect(reporter).toHaveBeenCalledWith(failure, { scope: 'usePlaceSearch.retrieve' });
  });

  it('cancels the retrieve and resolves to nothing when the user leaves the screen', async () => {
    const hook = await setup();
    await search(hook, 'Space');
    const request = deferred<Place>();
    retrieve.mockReturnValueOnce(request.promise);

    let picking: Promise<Place | null> = Promise.resolve(PLACE);
    await act(async () => {
      picking = hook.result.current.pick('needle');
    });
    await hook.unmount();

    expect(retrieve.mock.calls[0][2].aborted).toBe(true);
    request.resolve(PLACE);
    await expect(picking).resolves.toBeNull();
    expect(reporter).not.toHaveBeenCalled();
  });
});
