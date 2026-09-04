/**
 * @file tripImage.ts
 * @description Helps render trip image or default to a fallback image if none exist
 */
import type { ImageSourcePropType } from 'react-native';

export const defaultTripImage: ImageSourcePropType = require('@assets/images/trip-placeholder.png');

export const tripImageSource = (image: string | null | undefined): ImageSourcePropType =>
  image ? { uri: image } : defaultTripImage;
