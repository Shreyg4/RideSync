import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorText from '@/src/components/ErrorText';
import PlaceResultItem from '@/src/components/PlaceResultItem';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import { StopMarkers } from '@/src/components/StopsMap';
import TripMap from '@/src/components/TripMap';
import { colors, fontSize, radii, spacing } from '@/src/constants/theme';
import {
  parseNextStopType,
  parseStopId,
  parseStopPosition,
  PLACE_QUERY_MAX_LENGTH,
} from '@/src/domain/rules';
import type { NextStopType } from '@/src/domain/rules';
import { useAsync } from '@/src/hooks/useAsync';
import { useCurrentLocation } from '@/src/hooks/useCurrentLocation';
import { usePlaceSearch } from '@/src/hooks/usePlaceSearch';
import { toPlaceParam } from '@/src/lib/placeParam';
import { toTripStop } from '@/src/lib/tripMapper';
import { listTripStops } from '@/src/services/tripStopService';

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
  // so a failed load only leaves the pins off
  const { data: stops, loading: loadingStops } = useAsync(
    async () => (Number.isInteger(tripId) ? (await listTripStops(tripId)).map(toTripStop) : []),
    [tripId],
    'AddStopScreen.listTripStops'
  );
  const { query, setQuery, results, searching, pickingId, error, noResults, pick } =
    usePlaceSearch(location);

  const [searchFocused, setSearchFocused] = useState(false);

  const ResultSeperator = () => <View style={styles.horizontalLine} />;

  // Text keeps search open after the keyboard closes, so the results can still be scrolled and tapped
  const searchOpen = searchFocused || query.length > 0;

  const closeSearch = useCallback(() => {
    setSearchFocused(false);
    setQuery('');
    Keyboard.dismiss();
  }, [setQuery]);

  // Android's back button closes search before it leaves the screen, like the X beside the box does
  useEffect(() => {
    if (!searchOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearch();
      return true;
    });
    return () => subscription.remove();
  }, [searchOpen, closeSearch]);

  const openPlace = async (mapboxId: string) => {
    const place = await pick(mapboxId);
    if (!place) return;
    router.push({
      pathname: '/trips/[id]/stopDetails',
      params: {
        id: tripId,
        place: toPlaceParam(place),
        stopType,
        ...(atPosition === undefined ? {} : { atPosition }),
        ...(stopId === undefined ? {} : { stopId }),
      },
    });
  };

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
            fitTo={stops ?? []}
            // Fits the pins below the search bar instead of under it
            coveredEdges={{ top: insets.top + spacing.sm + SEARCH_BAR_HEIGHT }}
            // Full screen leaves room to zoom out further than the planner's small map, so the
            // stops sit well inside the screen rather than along its edges
            fitMargin={ADD_STOP_FIT_MARGIN}
            testID="add-stop-map"
          >
            {/* Only for reference here: tapping a pin would leave search */}
            <StopMarkers stops={stops ?? []} />
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
            onChangeText={setQuery}
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
        <ErrorText message={error} style={styles.message} testID="place-search-error" />

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
