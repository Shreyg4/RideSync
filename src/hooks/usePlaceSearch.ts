/**
 * @file usePlaceSearch.ts
 * @description The typing half of the search screen. Debounces /suggest, cancels outdated requests,
 * and keeps one Mapbox session token from the first /suggest through the /retrieve that ends it
 */
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reportAndDescribe } from '@/src/services/errors';
import { retrievePlace, suggestPlaces } from '@/src/services/mapboxSearchService';
import type { Coordinates, Place, PlaceSuggestion } from '@/src/types/trip';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export const usePlaceSearch = (proximity: Coordinates | null) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [completedQuery, setCompletedQuery] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState(() => Crypto.randomUUID());

  const cancelSearch = useRef(() => {});
  const pickController = useRef<AbortController | null>(null);
  const sessionEnded = useRef(false);

  const text = query.trim();

  useEffect(() => {
    setError(null);

    if (text.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const suggestions = await suggestPlaces(text, sessionToken, proximity, controller.signal);
        if (controller.signal.aborted) return;
        setResults(suggestions);
        setCompletedQuery(text);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(reportAndDescribe(searchError, { scope: 'usePlaceSearch.suggest' }));
      }
      setSearching(false);
    }, DEBOUNCE_MS);

    const cancel = () => {
      clearTimeout(timer);
      controller.abort();
    };
    cancelSearch.current = cancel;
    return cancel;
  }, [text, proximity, sessionToken]);

  // Leaving mid-retrieve must not open the next screen
  useEffect(() => () => pickController.current?.abort(), []);

  // A successful /retrieve ended the session, so the results left on screen belong to a dead token.
  // Waiting until the user returns means a normal add never starts a session it won't use
  useFocusEffect(
    useCallback(() => {
      if (!sessionEnded.current) return;
      sessionEnded.current = false;
      setSessionToken(Crypto.randomUUID());
    }, [])
  );

  // Resolves to null when there is nothing to open: a failure (shown in error), a cancelled request,
  // or a tap ignored because another place is already loading
  const pick = useCallback(
    async (mapboxId: string): Promise<Place | null> => {
      if (pickController.current) return null;

      // A /suggest sent after this /retrieve would reuse the token of a finished session
      cancelSearch.current();
      setSearching(false);
      setError(null);
      setPickingId(mapboxId);

      const controller = new AbortController();
      pickController.current = controller;

      try {
        const place = await retrievePlace(mapboxId, sessionToken, controller.signal);
        if (controller.signal.aborted) return null;
        sessionEnded.current = true;
        return place;
      } catch (retrieveError) {
        if (!controller.signal.aborted) {
          setError(reportAndDescribe(retrieveError, { scope: 'usePlaceSearch.retrieve' }));
        }
        return null;
      } finally {
        pickController.current = null;
        if (!controller.signal.aborted) setPickingId(null);
      }
    },
    [sessionToken]
  );

  return {
    query,
    setQuery,
    results,
    searching,
    pickingId,
    error,
    pick,
    // Only true once this exact text has come back empty, so it can't flash while typing
    noResults: completedQuery === text && results.length === 0 && !error,
  };
};
