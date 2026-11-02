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
import type { TripFormValues, TripImageInput, TripType } from '../types/trip';
import { createTrip, updateTrip, type NewTrip, type TripRow } from './tripService';

export type CreateTripInput = {
  userId: string;
  name: string;
  tripType: TripType;
  startsAt: Date;
  image?: TripImageInput | null;
};

export const createTripWithImage = async ({
  userId,
  name,
  tripType,
  startsAt,
  image,
}: CreateTripInput): Promise<TripRow> => {
  let uploaded: string | null = null;
  if (image?.kind === 'local') {
    uploaded = tripImageObjectPath(userId, image.mimeType);
    await uploadTripImageFile(uploaded, image.uri, image.mimeType);
  }
  // A stored image is reused from a saved trip, which still needs it, so it's never removed here
  const imagePath = uploaded ?? (image?.kind === 'stored' ? image.path : null);

  try {
    return await createTrip({
      name,
      trip_type: tripType,
      starts_at: startsAt.toISOString(),
      image_url: imagePath,
    });
  } catch (error) {
    if (uploaded) {
      removeTripImageFile(uploaded).catch((cleanupError) =>
        reportError(cleanupError, {
          scope: 'tripCreationService.createTripWithImage.cleanup',
          imagePath: uploaded,
        })
      );
    }
    throw error;
  }
};

export const updateTripWithImage = async (
  userId: string,
  trip: TripRow,
  values: TripFormValues
) => {
  const changes: Partial<NewTrip> = {};
  if (values.name !== trip.name) changes.name = values.name;
  if (values.tripType !== trip.trip_type) changes.trip_type = values.tripType;
  if (values.startsAt.getTime() !== new Date(trip.starts_at).getTime()) {
    changes.starts_at = values.startsAt.toISOString();
  }

  let uploaded: string | null = null;
  if (values.image?.kind === 'local') {
    uploaded = tripImageObjectPath(userId, values.image.mimeType);
    await uploadTripImageFile(uploaded, values.image.uri, values.image.mimeType);
    changes.image_url = uploaded;
  } else if (!values.image && trip.image_url) {
    changes.image_url = null;
  }

  if (Object.keys(changes).length === 0) return;

  try {
    await updateTrip(trip.id, changes);
  } catch (error) {
    if (uploaded) {
      removeTripImageFile(uploaded).catch((cleanupError) =>
        reportError(cleanupError, {
          scope: 'tripCreationService.updateTripWithImage.cleanup',
          uploaded,
        })
      );
    }
    throw error;
  }
};
