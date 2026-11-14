import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Locate, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Chip from '@/src/components/Chip';
import ErrorText from '@/src/components/ErrorText';
import PlaceCard from '@/src/components/PlaceCard';
import PlaceMarkers from '@/src/components/PlaceMarkers';
import PlaceResultItem from '@/src/components/PlaceResultItem';
import RouteSearchLayers from '@/src/components/RouteSearchLayers';
import RouteSearchPanel from '@/src/components/RouteSearchPanel';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import { RouteLine, StopMarkers } from '@/src/components/StopsMap';
import TripMap from '@/src/components/TripMap';
import { colors, fontSize, radii, spacing } from '@/src/constants/theme';
import {
  parseNextStopType,
  parseStopId,
  parseStopPosition,
  PLACE_QUERY_MAX_LENGTH,
  SEARCH_CATEGORIES,
  stopCategoryLabel,
} from '@/src/domain/rules';
import type { NextStopType, SearchCategory } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { useCategorySearch } from '@/src/hooks/useCategorySearch';
import { useCurrentLocation } from '@/src/hooks/useCurrentLocation';
import { usePlaceSearch } from '@/src/hooks/usePlaceSearch';
import { useRouteSearchPoint } from '@/src/hooks/useRouteSearchPoint';
import { useTripRoute } from '@/src/hooks/useTripRoute';
import { routeSections, sectionStopIds } from '@/src/domain/route';
import { distanceMeters, METERS_PER_MILE } from '@/src/lib/geo';
import { areaAround } from '@/src/lib/mapCamera';
import { toPlaceParam } from '@/src/lib/placeParam';
import { joinPolylines } from '@/src/lib/polyline';
import { toTrip, toTripStop } from '@/src/lib/tripMapper';
import { getTrip } from '@/src/services/tripService';
import { listTripStops } from '@/src/services/tripStopService';
import type { Coordinates, Place } from '@/src/types/trip';

const SEARCH_PLACEHOLDERS: Record<NextStopType, string> = {
  start: 'Where does the trip start?',
  end: 'Where does the trip end?',
  destination: 'Where are you headed?',
  stop: 'Search for a place',
};

// With no title on the screen, the box is what says a stop is moving rather than being added
const CHANGE_PLACE_PLACEHOLDER = 'Search for its new place';

// Room around the outermost stops when the map fits them
const ADD_STOP_FIT_MARGIN = 100;

const SEARCH_BAR_HEIGHT = 52;
const SEARCH_BUTTON_SIZE = 44;
// Centers the button in the bar's rounded left end
const SEARCH_BUTTON_INSET = (SEARCH_BAR_HEIGHT - SEARCH_BUTTON_SIZE) / 2;

const AddStopScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string | string[];
    stopType?: string | string[];
    atPosition?: string | string[];
    stopId?: string | string[];
  }>();
  const tripId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const stopType = parseNextStopType(params.stopType);
  // Only a stop on a round trip's drive home has a position, which the preview passes to the save
  const atPosition = parseStopPosition(params.atPosition);
  // Set when Change place opened search, so the preview moves that stop instead of adding one
  const stopId = parseStopId(params.stopId);

  const { location, loading: locating } = useCurrentLocation();
  // Shows where the trip already goes while picking the next place. Search works without them,
  // so a failed load only leaves the pins and route off. The trip type says whether the route
  // drives back to the start
  const { data: trip, loading: loadingStops } = useAsync(
    async () => {
      if (!Number.isInteger(tripId)) return { stops: [], tripType: undefined };
      const [tripRow, stopRows] = await Promise.all([getTrip(tripId), listTripStops(tripId)]);
      return {
        stops: stopRows.map(toTripStop),
        tripType: tripRow ? toTrip(tripRow).tripType : undefined,
      };
    },
    [tripId],
    'AddStopScreen.loadTrip'
  );
  const stops = trip?.stops;
  // Usually the route the planner already saved, so opening search costs no Directions request
  const {
    route,
    error: routeError,
    retry: retryRoute,
  } = useTripRoute(tripId, stops, trip?.tripType);
  // The route split into the way there and a round trip's way back, for searching along it
  const sections = useMemo(
    () =>
      route && stops && trip?.tripType
        ? routeSections(stops, trip.tripType, route.legs, joinPolylines(route.geometry))
        : null,
    [route, stops, trip?.tripType]
  );
  const { query, setQuery, results, searching, pickingId, error, noResults, pick } =
    usePlaceSearch(location);

  const [searchFocused, setSearchFocused] = useState(false);

  // Searching the map by kind of place, around a point on the route. Only for adding a normal stop:
  // the start, end and destination come before there's a route, and moving a stop keeps its place
  // The planner's Add return stop is the only way in with a position, so it opens on the way home
  const routeSearch = useRouteSearchPoint(
    sections,
    atPosition === undefined ? 'outbound' : 'return'
  );
  const { point, section, radiusMiles } = routeSearch;
  const canBrowse = stopType === 'stop' && stopId === undefined && section !== null;

  const nearby = useCategorySearch();
  const clearNearby = nearby.clear;
  const [category, setCategory] = useState<SearchCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The circle the newest search looked in. Mapbox searches a square around it, so what it finds in
  // the square's corners is dropped, leaving only what the circle on the map shows
  const [searchedCircle, setSearchedCircle] = useState<{
    center: Coordinates;
    radiusMeters: number;
  } | null>(null);
  const found = useMemo(
    () =>
      searchedCircle
        ? nearby.results.filter(
            (place) =>
              distanceMeters(
                [searchedCircle.center.lng, searchedCircle.center.lat],
                [place.lng, place.lat]
              ) <= searchedCircle.radiusMeters
          )
        : nearby.results,
    [nearby.results, searchedCircle]
  );
  const selectedPlace = found.find((place) => place.mapboxId === selectedId) ?? null;
  // While a slider moves, the point and circle follow it, but nothing searches until it's let go
  const [dragging, setDragging] = useState(false);
  // Where a found place goes in the trip: after the stop that starts the leg the search looked along.
  // Kept from when the search ran, since the slider can move on after it
  const [resultsPosition, setResultsPosition] = useState<number | undefined>(undefined);

  // Only the stops on the drive being searched, so a round trip's way there and way back don't
  // crowd the map together
  const visibleStopIds = useMemo(
    () => (canBrowse && section && stops ? sectionStopIds(stops, section) : undefined),
    [canBrowse, section, stops]
  );

  // The way of the trip being searched, as places the map can fit
  const sectionPlaces = useMemo(
    () => section?.line.map(([lng, lat]) => ({ lat, lng })) ?? null,
    [section]
  );
  // Null fits the map to what's being searched: the chosen way of the trip, or every stop without a
  // route. A category search fits it to the point and what was found
  const [cameraPlaces, setCameraPlaces] = useState<readonly Coordinates[] | null>(null);
  // Set while the newest search should fit the map to its results
  const fitResultsAround = useRef<Coordinates | null>(null);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const defaultFit = (canBrowse ? sectionPlaces : null) ?? stops ?? [];

  // Back to every stop in the trip. A category search's pins stay, so its results can still be tapped
  const showAllStops = () => {
    fitResultsAround.current = null;
    setCameraPlaces(stops ?? null);
    setRecenterRequest((count) => count + 1);
  };

  // The panel covers the bottom of the map, so fitting it keeps places clear of it
  const [panelHeight, setPanelHeight] = useState(0);

  useEffect(() => {
    const center = fitResultsAround.current;
    if (!center || found.length === 0) return;
    fitResultsAround.current = null;
    setCameraPlaces([center, ...found]);
  }, [found]);

  // Searches the chosen category around the point whenever either one settles: a chip tapped, a
  // slider let go, or the way of the trip changed. One search per change, never mid-drag
  const searchedFor = useRef<string | null>(null);
  const nearbySearch = nearby.search;
  useEffect(() => {
    if (!category || !point || dragging) return;
    // The leg is part of it: on a road driven both ways, the same spot on the way back is a new
    // search, since what it finds goes in a different place in the trip
    const key = `${category}|${point.legIndex}|${point.lat},${point.lng}|${radiusMiles}`;
    if (key === searchedFor.current) return;
    searchedFor.current = key;

    const radiusMeters = radiusMiles * METERS_PER_MILE;
    fitResultsAround.current = point;
    setCameraPlaces([point]);
    setSelectedId(null);
    setResultsPosition(point.legIndex + 1);
    setSearchedCircle({ center: point, radiusMeters });
    nearbySearch(category, areaAround(point, radiusMeters / 1000));
  }, [category, point, radiusMiles, dragging, nearbySearch]);

  const clearBrowse = useCallback(() => {
    fitResultsAround.current = null;
    searchedFor.current = null;
    setSearchedCircle(null);
    setCategory(null);
    clearNearby();
    setSelectedId(null);
    setCameraPlaces(null);
  }, [clearNearby]);

  const toggleCategory = (next: SearchCategory) => {
    if (category === next) clearBrowse();
    else setCategory(next);
  };

  // A new way of the trip fits the map to it, unless a search is about to fit it to its results
  const settleSearchPoint = () => {
    setDragging(false);
    if (!category) setCameraPlaces(null);
  };

  // Typed search and the map search never show at once, so typing clears the chip and its pins
  const changeQuery = (text: string) => {
    if (text.trim() && category) clearBrowse();
    setQuery(text);
  };

  const ResultSeperator = () => <View style={styles.horizontalLine} />;

  // Text keeps search open after the keyboard closes, so the results can still be scrolled and tapped
  const searchOpen = searchFocused || query.length > 0;

  const closeSearch = useCallback(() => {
    setSearchFocused(false);
    setQuery('');
    Keyboard.dismiss();
  }, [setQuery]);

  // Android's back button undoes one thing at a time before it leaves the screen: search, then the
  // tapped place, then the category search
  const browsing = selectedId !== null || category !== null;
  useEffect(() => {
    if (!searchOpen && !browsing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchOpen) closeSearch();
      else if (selectedId !== null) setSelectedId(null);
      else clearBrowse();
      return true;
    });
    return () => subscription.remove();
  }, [searchOpen, browsing, selectedId, closeSearch, clearBrowse]);

  // A place found on the map goes where its search looked. A typed search's place goes where the
  // planner opened search, or else where add_trip_stop puts a stop given no position
  const openPreview = (place: Place, position = atPosition) =>
    router.push({
      pathname: '/trips/[id]/stopDetails',
      params: {
        id: tripId,
        place: toPlaceParam(place),
        stopType,
        ...(position === undefined ? {} : { atPosition: position }),
        ...(stopId === undefined ? {} : { stopId }),
      },
    });

  const openPlace = async (mapboxId: string) => {
    const place = await pick(mapboxId);
    if (place) openPreview(place);
  };

  // Nothing at all, or nothing inside the circle once the square's corners are dropped
  const nothingFound =
    nearby.noResults || (!nearby.searching && nearby.results.length > 0 && found.length === 0);
  const statusMessage = nearby.searching
    ? null
    : nothingFound
      ? 'Nothing found here. Try another time or a wider radius.'
      : null;

  // Typed search covers the map, panel included
  const showPanel = canBrowse && !searchOpen;

  // Back to every stop. It always sits above a tapped place's card. With the panel showing, it drops
  // right onto the panel when there's no card
  const recenterButton =
    stops && stops.length > 0 ? (
      <SmallButton
        // The standard small button: blue icon, full size
        icon={Locate}
        onPress={showAllStops}
        accessibilityLabel="Show all stops"
        backgroundColor={colors.background}
        style={[
          styles.recenter,
          showPanel && styles.recenterOnSheet,
          showPanel && selectedPlace && styles.recenterAboveCard,
        ]}
        testID="show-all-stops"
      />
    ) : null;

  return (
    <View style={styles.screen}>
      {/* The map fills the screen, so a swipe from its edge has to pan the map, not leave */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Stays mounted under search, so closing search shows the map where it was left */}
      <View
        pointerEvents={searchOpen ? 'none' : 'auto'}
        style={StyleSheet.absoluteFill}
        testID="add-stop-map-touch"
      >
        {/* A map only uses its starting position on mount, so it waits for the location and the
            stops. It opens fitted to the stops, like the planner's, or on the user before there are any */}
        {locating || loadingStops ? null : (
          <TripMap
            initialCenter={location ?? undefined}
            fitTo={cameraPlaces ?? defaultFit}
            // Fits the pins below the search bar and its chips, and above the panel at the bottom
            coveredEdges={{
              top: insets.top + spacing.sm + SEARCH_BAR_HEIGHT,
              // The panel's height already holds the home indicator's space
              bottom: canBrowse ? panelHeight : 0,
            }}
            // Full screen leaves room to zoom out further than the planner's small map, so the
            // stops sit well inside the screen rather than along its edges
            fitMargin={ADD_STOP_FIT_MARGIN}
            recenterRequest={recenterRequest}
            testID="add-stop-map"
          >
            {/* Only for reference here: tapping a pin would leave search */}
            {route ? <RouteLine route={route} dimmed={canBrowse} /> : null}
            {canBrowse && section && point ? (
              <RouteSearchLayers
                sectionLine={section.line}
                point={point}
                radiusMeters={radiusMiles * METERS_PER_MILE}
              />
            ) : null}
            <StopMarkers stops={stops ?? []} visibleIds={visibleStopIds} />
            <PlaceMarkers
              places={found}
              selectedId={selectedId}
              onSelect={(place) => setSelectedId(place.mapboxId)}
            />
          </TripMap>
        )}
      </View>

      {/* Keeps the status bar and the search bar readable over a bright map */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0, 0, 0, 0.8)', 'transparent']}
        style={[styles.topFade, { height: insets.top + SEARCH_BAR_HEIGHT * 2 }]}
        testID="add-stop-top-fade"
      />

      {searchOpen ? (
        <View pointerEvents="none" style={styles.backdrop} testID="add-stop-backdrop" />
      ) : null}

      {/* Lets touches through to the map wherever the search bar and results aren't */}
      <KeyboardAvoidingView
        behavior="padding"
        pointerEvents="box-none"
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + spacing.sm,
            // The panel reaches the bottom edge and keeps clear of the home indicator itself
            paddingBottom: showPanel ? 0 : insets.bottom + spacing.sm,
          },
        ]}
      >
        {/* One full-width bar, like a maps app: the button sits inside the box at its left end */}
        <View style={styles.searchBar} testID="place-search-bar">
          <TextBox
            value={query}
            onChangeText={changeQuery}
            placeholder={
              stopId === undefined ? SEARCH_PLACEHOLDERS[stopType] : CHANGE_PLACE_PLACEHOLDER
            }
            maxLength={PLACE_QUERY_MAX_LENGTH}
            width="100%"
            height={SEARCH_BAR_HEIGHT}
            borderRadius={radii.pill}
            marginVertical={0}
            // Starts the text after the button, and gives back the right edge kept for a password eye
            style={styles.searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            testID="place-search-input"
          />
          <SmallButton
            // Stays an X with the keyboard closed, since this still clears the search, not leaves
            icon={searchOpen ? X : ChevronLeft}
            onPress={searchOpen ? closeSearch : () => router.back()}
            accessibilityLabel={searchOpen ? 'Close search' : 'Go back'}
            color={colors.text}
            backgroundColor="transparent"
            size={24}
            diameter={SEARCH_BUTTON_SIZE}
            style={styles.searchButton}
          />
        </View>
        <ErrorText
          message={error ?? nearby.error}
          style={styles.message}
          testID="place-search-error"
        />

        {searchOpen ? (
          // A tap on the empty area closes the keyboard, which a plain View doesn't do
          <Pressable
            accessible={false}
            onPress={Keyboard.dismiss}
            style={styles.searchBody}
            testID="place-search-body"
          >
            {searching && results.length === 0 ? (
              <View style={styles.resultsPanel}>
                <ActivityIndicator
                  color={colors.tint}
                  style={styles.status}
                  testID="place-search-loading"
                />
              </View>
            ) : null}

            {noResults ? (
              <View style={styles.resultsPanel}>
                <Text style={styles.status}>No places found</Text>
              </View>
            ) : null}

            {results.length > 0 ? (
              <FlatList
                data={results}
                keyExtractor={(place) => place.mapboxId}
                ItemSeparatorComponent={ResultSeperator}
                renderItem={({ item }) => (
                  <PlaceResultItem
                    place={item}
                    loading={pickingId === item.mapboxId}
                    onPress={() => openPlace(item.mapboxId)}
                    testID={`place-result-${item.mapboxId}`}
                  />
                )}
                // Without this the first tap only closes the keyboard instead of picking the result
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.resultsPanel}
                testID="place-results"
              />
            ) : null}
          </Pressable>
        ) : null}

        {searchOpen ? null : (
          <View pointerEvents="box-none" style={[styles.cardArea, showPanel && styles.aboveSheet]}>
            {recenterButton}
            {selectedPlace ? (
              <PlaceCard
                place={selectedPlace}
                onChoose={() => openPreview(selectedPlace, resultsPosition)}
                onClose={() => setSelectedId(null)}
                testID="place-card"
              />
            ) : null}
            {/* Without a route there's nowhere along it to search, so this says why the panel is
                missing. Typed search still works */}
            {stopType === 'stop' && stopId === undefined && !section && routeError ? (
              <ErrorText
                message={routeError}
                onRetry={retryRoute}
                style={styles.routeError}
                testID="route-search-error"
              />
            ) : null}
          </View>
        )}

        {showPanel ? (
          <RouteSearchPanel
            search={routeSearch}
            bottomInset={insets.bottom}
            onDragging={() => setDragging(true)}
            onSettled={settleSearchPoint}
            onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
          >
            {/* What to look for at the point, last, since it's what starts a search */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              testID="category-chips"
            >
              {SEARCH_CATEGORIES.map((chip) => (
                <Chip
                  key={chip}
                  label={stopCategoryLabel(chip)}
                  selected={category === chip}
                  onPress={() => toggleCategory(chip)}
                  testID={`category-chip-${chip}`}
                />
              ))}
            </ScrollView>
            {nearby.searching ? (
              <ActivityIndicator color={colors.tint} testID="category-search-loading" />
            ) : statusMessage ? (
              <Text style={styles.panelStatus}>{statusMessage}</Text>
            ) : null}
          </RouteSearchPanel>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
};

export default AddStopScreen;

const styles = StyleSheet.create({
  // Shows behind the map while the location lookup holds it back
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // Dims the map behind the results the way the old search screen's dark background did
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBar: {
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  searchInput: {
    paddingLeft: SEARCH_BUTTON_INSET + SEARCH_BUTTON_SIZE + spacing.xxs,
    paddingRight: spacing.md,
  },
  searchButton: {
    position: 'absolute',
    left: SEARCH_BUTTON_INSET,
  },
  message: {
    alignSelf: 'center',
  },
  chips: {
    gap: spacing.xs,
  },
  routeError: {
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  panelStatus: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    textAlign: 'center',
  },
  // Sits at the bottom of the screen, below whatever the search bar and controls take up
  cardArea: {
    flex: 1,
    justifyContent: 'flex-end',
    marginHorizontal: spacing.sm,
  },
  recenterOnSheet: {
    marginBottom: 0,
  },
  recenterAboveCard: {
    marginBottom: spacing.sm,
  },
  // Keeps the place card and the recenter button off the panel's top edge
  aboveSheet: {
    marginBottom: spacing.sm,
  },
  // Sits nearer the corner than the card below it
  recenter: {
    alignSelf: 'flex-end',
    marginRight: -spacing.xxs,
    marginBottom: spacing.xxl * 1.5,
  },
  searchBody: {
    flex: 1,
  },
  // Sizes to its rows, and scrolls once the keyboard leaves too little room for them
  resultsPanel: {
    flexGrow: 0,
    flexShrink: 1,
    borderRadius: radii.lg,
    margin: spacing.sm,
  },
  horizontalLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textMutedLight,
    width: '95%',
    alignSelf: 'center',
  },
  status: {
    color: colors.textMutedLight,
    fontSize: fontSize.caption,
    padding: spacing.md,
    textAlign: 'center',
  },
});
