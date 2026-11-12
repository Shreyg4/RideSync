// Each chip tap, From change or Search this area sends one request. These check that only the newest
// answer reaches the map, and what the screen is told while one is out
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { SearchCategory } from '@/src/domain/rules';
import type { MapArea } from '@/src/lib/mapCamera';
import { setErrorReporter } from '@/src/lib/logger';
import { searchCategory } from '@/src/services/mapboxSearchService';
import type { Place } from '@/src/types/trip';
import { useCategorySearch } from '../useCategorySearch';

jest.mock('@/src/services/mapboxSearchService', () => ({
  searchCategory: jest.fn(),
}));

const search = searchCategory as unknown as jest.Mock<
  (category: SearchCategory, area: MapArea, signal: AbortSignal) => Promise<Place[]>
>;

const AREA: MapArea = { bbox: [-122.5, 47.5, -122.1, 47.7], center: { lat: 47.6, lng: -122.3 } };
const OTHER_AREA: MapArea = { bbox: [-121, 46, -120, 47], center: { lat: 46.5, lng: -120.5 } };
const place = (id: string): Place => ({
  mapboxId: id,
  name: id,
  address: null,
  lat: 47.6,
  lng: -122.3,
  category: 'gas',
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setup = () => renderHook(() => useCategorySearch());

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  setErrorReporter(jest.fn());
  search.mockResolvedValue([place('a')]);
});

afterEach(() => setErrorReporter(null));

describe('useCategorySearch', () => {
  it('starts with no category and nothing to show', async () => {
    const hook = await setup();

    expect(hook.result.current).toMatchObject({
      category: null,
      results: [],
      searching: false,
      error: null,
      noResults: false,
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('searches the category in the area and shows what it finds', async () => {
    const hook = await setup();

    await act(async () => hook.result.current.search('gas', AREA));

    expect(search).toHaveBeenCalledWith('gas', AREA, expect.any(AbortSignal));
    expect(hook.result.current.category).toBe('gas');
    expect(hook.result.current.results).toEqual([place('a')]);
    expect(hook.result.current.searching).toBe(false);
  });

  it('says it is searching, with the old pins gone, until the answer comes', async () => {
    const hook = await setup();
    await act(async () => hook.result.current.search('gas', AREA));
    const pending = deferred<Place[]>();
    search.mockReturnValueOnce(pending.promise);

    await act(async () => hook.result.current.search('food', AREA));

    expect(hook.result.current.searching).toBe(true);
    expect(hook.result.current.results).toEqual([]);
    expect(hook.result.current.noResults).toBe(false);

    await act(async () => pending.resolve([place('b')]));
    expect(hook.result.current.results).toEqual([place('b')]);
  });

  it('cancels the older search, so its late answer never replaces the newer one', async () => {
    const hook = await setup();
    const first = deferred<Place[]>();
    const second = deferred<Place[]>();
    search.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    await act(async () => hook.result.current.search('gas', AREA));
    await act(async () => hook.result.current.search('gas', OTHER_AREA));
    const firstSignal = search.mock.calls[0][2];
    await act(async () => second.resolve([place('new')]));
    await act(async () => first.resolve([place('old')]));

    expect(firstSignal.aborted).toBe(true);
    expect(hook.result.current.results).toEqual([place('new')]);
  });

  it('searches again for the same area, like Search this area tapped twice', async () => {
    const hook = await setup();

    await act(async () => hook.result.current.search('gas', AREA));
    await act(async () => hook.result.current.search('gas', AREA));

    expect(search).toHaveBeenCalledTimes(2);
  });

  it('says nothing was found only once the empty answer is in', async () => {
    const hook = await setup();
    search.mockResolvedValueOnce([]);

    await act(async () => hook.result.current.search('rest', AREA));

    expect(hook.result.current.noResults).toBe(true);
  });

  it('clears the category, its pins and any request still out', async () => {
    const hook = await setup();
    const pending = deferred<Place[]>();
    search.mockReturnValueOnce(pending.promise);
    await act(async () => hook.result.current.search('gas', AREA));

    await act(async () => hook.result.current.clear());
    await act(async () => pending.resolve([place('late')]));

    expect(hook.result.current).toMatchObject({ category: null, results: [], searching: false });
  });

  it('shows a friendly message and reports a failed search', async () => {
    const reporter = jest.fn();
    setErrorReporter(reporter);
    const failure = Object.assign(new Error('Mapbox search failed: 500'), {
      code: 'mapbox_search_failed',
    });
    search.mockRejectedValueOnce(failure);
    const hook = await setup();

    await act(async () => hook.result.current.search('gas', AREA));

    expect(hook.result.current.error).toBe(
      'Search is not available right now. Try again in a moment.'
    );
    expect(hook.result.current.noResults).toBe(false);
    expect(reporter).toHaveBeenCalledWith(failure, { scope: 'useCategorySearch.search' });
  });
});
