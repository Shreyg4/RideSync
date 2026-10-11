/**
 * @file tripCreationService.ts
 * @description Connects the trip-images bucket and tripService so a trip and its cover image are created together
 */
import { reportError } from '../lib/logger';
import {
  removeTripImageFile,
  tripImageObjectPath,
  uploadTripImageFile,
} from '../lib/tripImageStorage';
import type { TripType } from '../types/trip';
import { createTrip, type TripRow } from './tripService';

export type CreateTripInput = {
  userId: string;
  name: string;
  tripType: TripType;
  startsAt: Date;
  image?: { uri: string; mimeType?: string } | null;
};

export const createTripWithImage = async ({
  userId,
  name,
  tripType,
  startsAt,
  image,
}: CreateTripInput): Promise<TripRow> => {
  let imagePath: string | null = null;
  if (image) {
    imagePath = tripImageObjectPath(userId, image.mimeType);
    await uploadTripImageFile(imagePath, image.uri, image.mimeType);
  }

  try {
    return await createTrip({
      name,
      trip_type: tripType,
      starts_at: startsAt.toISOString(),
      image_url: imagePath,
    });
  } catch (error) {
    if (imagePath) {
      removeTripImageFile(imagePath).catch((cleanupError) =>
        reportError(cleanupError, {
          scope: 'tripCreationService.createTripWithImage.cleanup',
          imagePath,
        })
      );
    }
    throw error;
  }
};
