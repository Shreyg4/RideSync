import type { ImageSourcePropType } from 'react-native';

export const defaultTripImage: ImageSourcePropType = require('@assets/images/trip-placeholder.png');

export const tripImageSource = (image: string | null | undefined): ImageSourcePropType =>
  image ? { uri: image } : defaultTripImage;
