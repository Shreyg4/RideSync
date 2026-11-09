import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Maximize2, X } from 'lucide-react-native';
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
import ScreenHeader from '@/src/components/ScreenHeader';
import SmallButton from '@/src/components/SmallButton';
import TextBox from '@/src/components/TextBox';
import TripMap from '@/src/components/TripMap';
import { haptics } from '@/src/constants/haptics';
import { pressFeedback } from '@/src/constants/pressFeedback';
import { colors, contentWidth, fontSize, gradients, radii, spacing } from '@/src/constants/theme';
import {
  parseNextStopType,
  parseStopId,
  parseStopPosition,
  PLACE_QUERY_MAX_LENGTH,
} from '@/src/domain/rules';
import type { NextStopType } from '@/src/domain/rules';
import { useCurrentLocation } from '@/src/hooks/useCurrentLocation';
import { usePlaceSearch } from '@/src/hooks/usePlaceSearch';
import { toPlaceParam } from '@/src/lib/placeParam';

const SEARCH_PLACEHOLDERS: Record<NextStopType, string> = {
  start: 'Where does the trip start?',
  end: 'Where does the trip end?',
  destination: 'Where are you headed?',
  stop: 'Search for a place',
};

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
  const { query, setQuery, results, searching, pickingId, error, noResults, pick } =
    usePlaceSearch(location);

  const [searchFocused, setSearchFocused] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const ResultSeperator = () => <View style={styles.horizontalLine} />;

  // Text keeps search open after the keyboard closes, so the results can still be scrolled and tapped
  const searchOpen = searchFocused || query.length > 0;
  const layerOpen = searchOpen || mapExpanded;

  const closeLayer = useCallback(() => {
    setMapExpanded(false);
    setSearchFocused(false);
    setQuery('');
    Keyboard.dismiss();
  }, [setQuery]);

  // Android's back button closes the open layer before it leaves the screen, like the header's does
  useEffect(() => {
    if (!layerOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeLayer();
      return true;
    });
    return () => subscription.remove();
  }, [layerOpen, closeLayer]);

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
      {/* A swipe from the screen's edge has to pan an expanded map, not leave the screen */}
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !mapExpanded }} />

      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.content, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        {/* Same as the planner: the gradient only spans the header */}
        <View>
          {searchOpen ? null : (
            <LinearGradient
              pointerEvents="none"
              {...gradients.cardToBackground()}
              style={StyleSheet.absoluteFill}
              testID="add-stop-gradient"
            />
          )}
          <ScreenHeader
            title={stopId === undefined ? 'Add Stop' : 'Change Place'}
            onBack={() => (layerOpen ? closeLayer() : router.back())}
            // Stays an X with the keyboard closed, since this still clears the search, not leaves
            backIcon={searchOpen ? X : undefined}
            backLabel={searchOpen ? 'Close search' : undefined}
          />
        </View>
        <TextBox
          value={query}
          onChangeText={setQuery}
          placeholder={SEARCH_PLACEHOLDERS[stopType]}
          maxLength={PLACE_QUERY_MAX_LENGTH}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          testID="place-search-input"
        />
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
        ) : (
          // One wrapper for both sizes, so expanding resizes the map instead of reloading it
          <View style={mapExpanded ? styles.mapFull : styles.mapPreview} testID="add-stop-map-box">
            <View
              pointerEvents={mapExpanded ? 'auto' : 'none'}
              style={styles.mapTouch}
              testID="add-stop-map-touch"
            >
              {/* A map only uses its starting position on mount, so it waits for the location lookup */}
              {locating ? null : (
                <TripMap initialCenter={location ?? undefined} testID="add-stop-map" />
              )}
            </View>

            {mapExpanded ? (
              <SmallButton
                icon={X}
                onPress={() => setMapExpanded(false)}
                accessibilityLabel="Close map"
                color={colors.text}
                backgroundColor="rgba(0, 0, 0, 0.6)"
                style={[styles.closeMap, { top: insets.top + spacing.sm }]}
              />
            ) : (
              <Pressable
                onPress={() => {
                  haptics.action();
                  setMapExpanded(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Expand map"
                style={({ pressed }) => [StyleSheet.absoluteFill, pressFeedback.card(pressed)]}
              >
                <View style={styles.expandHint}>
                  <Maximize2 color={colors.text} size={18} />
                </View>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

export default AddStopScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
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
  // Same size and shape as the cover image box on the trip form
  mapPreview: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    width: contentWidth,
    aspectRatio: 5 / 3,
    alignSelf: 'center',
    margin: spacing.sm,
    overflow: 'hidden',
  },
  mapFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.card,
  },
  mapTouch: {
    flex: 1,
  },
  expandHint: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  closeMap: {
    position: 'absolute',
    right: spacing.md,
  },
});
