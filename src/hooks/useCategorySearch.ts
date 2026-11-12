/**
 * @file useCategorySearch.ts
 * @description The map half of the search screen: one kind of place, searched in one area at a time.
 * A new search cancels the one before it, so an old answer can't replace the pins of a newer one
 */
import { useCallback, useEffect, useState } from 'react';
import type { SearchCategory } from '@/src/domain/rules';
import type { MapArea } from '@/src/lib/mapCamera';
import { reportAndDescribe } from '@/src/services/errors';
import { searchCategory } from '@/src/services/mapboxSearchService';
import type { Place } from '@/src/types/trip';

type CategoryRequest = { category: SearchCategory; area: MapArea };

export const useCategorySearch = () => {
  // A new object for every search, so searching the same area again still sends a request
  const [request, setRequest] = useState<CategoryRequest | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Old pins would read as answers to the new search while it loads
    setResults([]);
    setError(null);
    setSearched(false);

    if (!request) {
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();

    searchCategory(request.category, request.area, controller.signal)
      .then((places) => {
        if (controller.signal.aborted) return;
        setResults(places);
        setSearched(true);
        setSearching(false);
      })
      .catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(reportAndDescribe(searchError, { scope: 'useCategorySearch.search' }));
        setSearching(false);
      });

    return () => controller.abort();
  }, [request]);

  const search = useCallback(
    (category: SearchCategory, area: MapArea) => setRequest({ category, area }),
    []
  );
  const clear = useCallback(() => setRequest(null), []);

  return {
    category: request?.category ?? null,
    results,
    searching,
    error,
    search,
    clear,
    // Only once this area's answer is in, so it can't flash while a search is still going
    noResults: searched && results.length === 0,
  };
};
