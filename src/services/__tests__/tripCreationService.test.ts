// A trip and its cover image are two writes to two places, so these check that a failure in
// either one never leaves a trip pointing at a missing image or an image no trip uses.

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { setErrorReporter } from '@/src/lib/logger';
import {
  removeTripImageFile,
  tripImageObjectPath,
  uploadTripImageFile,
} from '@/src/lib/tripImageStorage';
import { createTripWithImage, type CreateTripInput } from '../tripCreationService';
import { createTrip, recreateSavedTrip, type TripRow } from '../tripService';

jest.mock('@/src/lib/tripImageStorage', () => ({
  tripImageObjectPath: jest.fn(() => 'user-1/1767225600000.png'),
  uploadTripImageFile: jest.fn(async () => {}),
  removeTripImageFile: jest.fn(async () => {}),
}));

jest.mock('../tripService', () => ({ createTrip: jest.fn(), recreateSavedTrip: jest.fn() }));

const IMAGE_PATH = 'user-1/1767225600000.png';
const STARTS_AT = new Date('2026-11-01T17:30:00.000Z');
const created = { id: 7, name: 'Coast Run' } as TripRow;
const image = { kind: 'local' as const, uri: 'file://cover.png', mimeType: 'image/png' };

const input: CreateTripInput = {
  userId: 'user-1',
  name: 'Coast Run',
  tripType: 'one-way',
  startsAt: STARTS_AT,
};

// Cleanup runs in the background, after the original error has already been thrown
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

let reporter: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createTrip).mockResolvedValue(created);
  jest.mocked(recreateSavedTrip).mockResolvedValue(created);
  reporter = jest.fn();
  setErrorReporter(reporter);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setErrorReporter(null);
});

describe('createTripWithImage', () => {
  it.each<[string, null | undefined]>([
    ['no', undefined],
    ['a null', null],
  ])('creates the trip without uploading when given %s image', async (_, noImage) => {
    await expect(createTripWithImage({ ...input, image: noImage })).resolves.toBe(created);

    expect(uploadTripImageFile).not.toHaveBeenCalled();
    expect(createTrip).toHaveBeenCalledWith({
      name: 'Coast Run',
      trip_type: 'one-way',
      starts_at: '2026-11-01T17:30:00.000Z',
      image_url: null,
    });
  });

  it(`uploads the cover image into the user's folder, then saves its path on the trip`, async () => {
    await expect(createTripWithImage({ ...input, image })).resolves.toBe(created);

    expect(tripImageObjectPath).toHaveBeenCalledWith('user-1', 'image/png');
    expect(uploadTripImageFile).toHaveBeenCalledWith(IMAGE_PATH, 'file://cover.png', 'image/png');
    expect(createTrip).toHaveBeenCalledWith(expect.objectContaining({ image_url: IMAGE_PATH }));
    expect(jest.mocked(uploadTripImageFile).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(createTrip).mock.invocationCallOrder[0]
    );
  });

  it('creates no trip when the image upload fails', async () => {
    const uploadError = new Error('upload failed');
    jest.mocked(uploadTripImageFile).mockRejectedValueOnce(uploadError);

    await expect(createTripWithImage({ ...input, image })).rejects.toBe(uploadError);
    expect(createTrip).not.toHaveBeenCalled();
    expect(removeTripImageFile).not.toHaveBeenCalled();
  });

  it('removes the uploaded image when the trip insert fails, and throws the insert error', async () => {
    const insertError = { code: '23514', message: 'check constraint' };
    jest.mocked(createTrip).mockRejectedValueOnce(insertError);

    await expect(createTripWithImage({ ...input, image })).rejects.toBe(insertError);
    await flushPromises();

    expect(removeTripImageFile).toHaveBeenCalledWith(IMAGE_PATH);
    expect(reporter).not.toHaveBeenCalled();
  });

  it('has nothing to remove when a trip with no image fails to insert', async () => {
    const insertError = { code: '23514', message: 'check constraint' };
    jest.mocked(createTrip).mockRejectedValueOnce(insertError);

    await expect(createTripWithImage(input)).rejects.toBe(insertError);
    expect(removeTripImageFile).not.toHaveBeenCalled();
  });

  it('reports a failed cleanup and still throws the insert error', async () => {
    const insertError = { code: '23514', message: 'check constraint' };
    const cleanupError = new Error('remove failed');
    jest.mocked(createTrip).mockRejectedValueOnce(insertError);
    jest.mocked(removeTripImageFile).mockRejectedValueOnce(cleanupError);

    await expect(createTripWithImage({ ...input, image })).rejects.toBe(insertError);
    await flushPromises();

    expect(reporter).toHaveBeenCalledWith(cleanupError, {
      scope: 'tripCreationService.createTripWithImage.cleanup',
      imagePath: IMAGE_PATH,
    });
  });
});

describe('createTripWithImage from a saved trip', () => {
  it('brings the saved itinerary along, moving departures by the days the start moved', async () => {
    const savedStart = new Date(2026, 9, 10, 8, 0);
    const newStart = new Date(2026, 9, 13, 20, 0);

    await expect(
      createTripWithImage({
        ...input,
        startsAt: newStart,
        image: { kind: 'stored', path: IMAGE_PATH },
        fromSavedTrip: { id: 4, startsAt: savedStart },
      })
    ).resolves.toBe(created);

    expect(createTrip).not.toHaveBeenCalled();
    expect(recreateSavedTrip).toHaveBeenCalledWith(
      4,
      {
        name: 'Coast Run',
        trip_type: 'one-way',
        starts_at: newStart.toISOString(),
        image_url: IMAGE_PATH,
      },
      3
    );
  });

  it('keeps departures where they are when the saved trip has no start', async () => {
    await createTripWithImage({ ...input, fromSavedTrip: { id: 4, startsAt: null } });

    expect(recreateSavedTrip).toHaveBeenCalledWith(4, expect.anything(), 0);
  });

  it('removes a newly uploaded image when re-creating fails', async () => {
    jest.mocked(recreateSavedTrip).mockRejectedValueOnce(new Error('insert failed'));

    await expect(
      createTripWithImage({ ...input, image, fromSavedTrip: { id: 4, startsAt: null } })
    ).rejects.toThrow('insert failed');
    await flushPromises();

    expect(removeTripImageFile).toHaveBeenCalledWith(IMAGE_PATH);
  });
});
