/**
 * @file mapStyle.ts
 * @description The base map the user picked in settings. Kept on the device, since it's a display
 * preference and not account data, and shared with every map through useMapStyle
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleURL } from '@rnmapbox/maps';
import { useSyncExternalStore } from 'react';
import { reportError } from '@/src/lib/logger';

export const MAP_STYLES = {
  streets: { label: 'Streets', url: StyleURL.Street },
  dark: { label: 'Dark', url: StyleURL.Dark },
  // The plain satellite style has no road names, which a trip map needs
  satellite: { label: 'Satellite', url: StyleURL.SatelliteStreet },
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

export const MAP_STYLE_KEYS = Object.keys(MAP_STYLES) as MapStyleKey[];

// A saved style that's no longer offered, like the old light map, falls back to this
export const DEFAULT_MAP_STYLE: MapStyleKey = 'streets';

// The key is stored rather than the URL, so a style's URL can change without losing the choice
const STORAGE_KEY = 'settings.mapStyle';

const isMapStyleKey = (value: unknown): value is MapStyleKey =>
  typeof value === 'string' && Object.hasOwn(MAP_STYLES, value);

let current: MapStyleKey = DEFAULT_MAP_STYLE;
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const loadSaved = async () => {
  loaded = true;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (isMapStyleKey(saved) && saved !== current) {
      current = saved;
      emit();
    }
  } catch (error) {
    reportError(error, { scope: 'mapStyle.load' });
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!loaded) loadSaved();
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => current;

/** Switches every map at once, then saves the choice for the next launch */
export const setMapStyle = async (style: MapStyleKey) => {
  // A pick made before the saved one finished loading wins over it
  loaded = true;
  if (style !== current) {
    current = style;
    emit();
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, style);
  } catch (error) {
    reportError(error, { scope: 'mapStyle.save' });
  }
};

export const useMapStyle = () => useSyncExternalStore(subscribe, getSnapshot);

/** Test-only: forgets the in-memory choice so the next subscriber reads storage again */
export const resetMapStyleForTests = () => {
  current = DEFAULT_MAP_STYLE;
  loaded = false;
  listeners.clear();
};
