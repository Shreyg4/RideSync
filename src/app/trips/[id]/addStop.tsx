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
import FromStopPicker from '@/src/components/FromStopPicker';
import PlaceCard from '@/src/components/PlaceCard';
import PlaceMarkers from '@/src/components/PlaceMarkers';
import PlaceResultItem from '@/src/components/PlaceResultItem';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import { StopMarkers } from '@/src/components/StopsMap';
import TripMap from '@/src/components/TripMap';
import { colors, fontSize, radii, spacing } from '@/src/constants/theme';
import {
  defaultFromStop,
  fromStopOptions,
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
import { areaAround } from '@/src/lib/mapCamera';
import type { MapArea } from '@/src/lib/mapCamera';
import { toPlaceParam } from '@/src/lib/placeParam';
import { toTripStop } from '@/src/lib/tripMapper';
import { listTripStops } from '@/src/services/tripStopService';
import type { Coordinates, Place, TripStop } from '@/src/types/trip';

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

// How far around the From stop a category search first looks. About a quarter hour's drive
const NEARBY_RADIUS_KM = 15;

// The From picker and the chips under the search bar, which fitting the map keeps its pins clear of
const BROWSE_CONTROLS_HEIGHT = 90;

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
  // so a failed load only leaves the pins off
  const { data: stops, loading: loadingStops } = useAsync(
    async () => (Number.isInteger(tripId) ? (await listTripStops(tripId)).map(toTripStop) : []),
    [tripId],
    'AddStopScreen.listTripStops'
  );
  const { query, setQuery, results, searching, pickingId, error, noResults, pick } =
    usePlaceSearch(location);

  const [searchFocused, setSearchFocused] = useState(false);

  // Searching the map by kind of place, around a stop of the user's choosing. Only for adding a
  // normal stop: the start, end and destination have no stop to search from yet, and moving a stop
  // keeps its place in the trip
  const fromOptions = useMemo(() => fromStopOptions(stops ?? []), [stops]);
  const defaultFrom = useMemo(() => defaultFromStop(stops ?? [], atPosition), [stops, atPosition]);
  const [chosenFromId, setChosenFromId] = useState<number | null>(null);
  const from = fromOptions.find((stop) => stop.id === chosenFromId) ?? defaultFrom;
  const canBrowse = stopType === 'stop' && stopId === undefined && from !== undefined;

  const nearby = useCategorySearch();
  const clearNearby = nearby.clear;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlace = nearby.results.find((place) => place.mapboxId === selectedId) ?? null;
  // Where the user has moved the map to since the last search, which Search this area looks in
  const [movedTo, setMovedTo] = useState<MapArea | null>(null);
  // Null fits the map to the trip's stops. A category search fits it to the From stop and what was found
  const [cameraPlaces, setCameraPlaces] = useState<readonly Coordinates[] | null>(null);
  // Set while the newest search should fit the map to its results. Searching where the user moved
  // the map leaves it there
  const fitResultsAround = useRef<Coordinates | null>(null);
  const [recenterRequest, setRecenterRequest] = useState(0);

  // Back to every stop in the trip. A category search's pins stay, so its results can still be tapped
  const showAllStops = () => {
    fitResultsAround.current = null;
    setCameraPlaces(null);
    setRecenterRequest((count) => count + 1);
  };

  useEffect(() => {
    const center = fitResultsAround.current;
    if (!center || nearby.results.length === 0) return;
    fitResultsAround.current = null;
    setCameraPlaces([center, ...nearby.results]);
  }, [nearby.results]);

  // Only a From the user changed is sent. Otherwise add_trip_stop picks the default place itself,
  // which stays right even if someone else adds a stop while this screen is open
  const position =
    from && defaultFrom && from.id !== defaultFrom.id ? from.position + 1 : atPosition;

  const searchAround = (category: SearchCategory, stop: TripStop) => {
    fitResultsAround.current = stop;
    setCameraPlaces([stop]);
    nearby.search(category, areaAround(stop, NEARBY_RADIUS_KM));
  };

  const clearBrowse = useCallback(() => {
    fitResultsAround.current = null;
    clearNearby();
    setSelectedId(null);
    setMovedTo(null);
    setCameraPlaces(null);
  }, [clearNearby]);

  const toggleCategory = (category: SearchCategory) => {
    if (!from) return;
    if (nearby.category === category) {
      clearBrowse();
      return;
    }
    setSelectedId(null);
    setMovedTo(null);
    searchAround(category, from);
  };

  const chooseFrom = (stop: TripStop) => {
    setChosenFromId(stop.id);
    setSelectedId(null);
    setMovedTo(null);
    if (nearby.category) searchAround(nearby.category, stop);
    else setCameraPlaces([stop]);
  };

  const searchThisArea = () => {
    if (!nearby.category || !movedTo) return;
    fitResultsAround.current = null;
    setSelectedId(null);
    setMovedTo(null);
    nearby.search(nearby.category, movedTo);
  };

  // Typed search and the map search never show at once, so typing clears the chip and its pins
  const changeQuery = (text: string) => {
    if (text.trim() && nearby.category) clearBrowse();
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
  const browsing = selectedId !== null || nearby.category !== null;
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

  const openPreview = (place: Place) =>
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

  const statusMessage = nearby.searching
    ? null
    : nearby.noResults
      ? 'Nothing found here. Move the map to look somewhere else.'
      : null;

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
            fitTo={cameraPlaces ?? stops ?? []}
            // Fits the pins below the search bar, and the map search's controls, instead of under them
            coveredEdges={{
              top:
                insets.top +
                spacing.sm +
                SEARCH_BAR_HEIGHT +
                (canBrowse ? BROWSE_CONTROLS_HEIGHT : 0),
            }}
            // Full screen leaves room to zoom out further than the planner's small map, so the
            // stops sit well inside the screen rather than along its edges
            fitMargin={ADD_STOP_FIT_MARGIN}
            onUserMoved={nearby.category ? setMovedTo : undefined}
            recenterRequest={recenterRequest}
            testID="add-stop-map"
          >
            {/* Only for reference here: tapping a pin would leave search */}
            <StopMarkers stops={stops ?? []} />
            <PlaceMarkers
              places={nearby.results}
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
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
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

        {canBrowse && from && !searchOpen ? (
          <View pointerEvents="box-none" style={styles.browseControls} testID="map-search-controls">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              testID="category-chips"
            >
              {SEARCH_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={stopCategoryLabel(category)}
                  selected={nearby.category === category}
                  onPress={() => toggleCategory(category)}
                  testID={`category-chip-${category}`}
                />
              ))}
            </ScrollView>
            <FromStopPicker stops={fromOptions} selected={from} onSelect={chooseFrom} />

            {nearby.searching ? (
              <ActivityIndicator
                color={colors.tint}
                style={styles.browseStatus}
                testID="category-search-loading"
              />
            ) : movedTo ? (
              <Pressable
                onPress={searchThisArea}
                accessibilityRole="button"
                style={({ pressed }) => [styles.searchArea, pressed && styles.searchAreaPressed]}
                testID="search-this-area"
              >
                <Text style={styles.searchAreaText}>Search this area</Text>
              </Pressable>
            ) : statusMessage ? (
              <Text style={[styles.status, styles.browseStatus]}>{statusMessage}</Text>
            ) : null}
          </View>
        ) : null}

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
          <View pointerEvents="box-none" style={styles.cardArea}>
            {stops && stops.length > 0 ? (
              <SmallButton
                // The standard small button: blue icon, full size
                icon={Locate}
                onPress={showAllStops}
                accessibilityLabel="Show all stops"
                backgroundColor={colors.background}
                style={styles.recenter}
                testID="show-all-stops"
              />
            ) : null}
            {selectedPlace ? (
              <PlaceCard
                place={selectedPlace}
                onChoose={() => openPreview(selectedPlace)}
                onClose={() => setSelectedId(null)}
                testID="place-card"
              />
            ) : null}
          </View>
        )}
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
  browseControls: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginHorizontal: spacing.sm,
  },
  chips: {
    gap: spacing.xs,
  },
  browseStatus: {
    alignSelf: 'center',
  },
  searchArea: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchAreaPressed: {
    opacity: 0.6,
  },
  searchAreaText: {
    color: colors.tint,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  // Sits at the bottom of the screen, below whatever the search bar and controls take up
  cardArea: {
    flex: 1,
    justifyContent: 'flex-end',
    marginHorizontal: spacing.sm,
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
