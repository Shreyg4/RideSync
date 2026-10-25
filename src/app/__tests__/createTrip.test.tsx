// The create-trip form has four required fields, two of them set through a native picker, so
// these drive the pickers by hand and check what reaches the service.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React from 'react';
import CreateTripScreen from '../createTrip';
import { createTripWithImage } from '@/src/services/tripCreationService';
import { anonymousAuth, renderScreen, signedInAuth } from '@/src/test/render';

// A component that renders nothing, so a test can read the props the screen gave it
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

jest.mock('@/src/services/tripCreationService', () => ({ createTripWithImage: jest.fn() }));

type View = Awaited<ReturnType<typeof renderScreen>>;
type PickerProps = { onChange: (event: DateTimePickerEvent, value?: Date) => void };

const DAY = new Date(2030, 5, 1);
const TIME = new Date(2030, 0, 1, 17, 30);
const STARTS_AT = new Date(2030, 5, 1, 17, 30);
const cover = { uri: 'file://cover.png', mimeType: 'image/png' };

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const pickerProps = () =>
  (DateTimePicker as unknown as jest.Mock).mock.calls.at(-1)?.[0] as PickerProps;

const answerPicker = (type: DateTimePickerEvent['type'], value?: Date) =>
  act(async () =>
    pickerProps().onChange(
      { type, nativeEvent: { timestamp: value?.getTime() ?? 0, utcOffset: 0 } },
      value
    )
  );

const pick = async (view: View, field: string, value: Date) => {
  await fireEvent.press(view.getByLabelText(field));
  await answerPicker('set', value);
  await fireEvent.press(view.getByText('Done'));
};

const fillForm = async (view: View, name = 'Coast Run') => {
  await fireEvent.changeText(view.getByLabelText('Enter trip name'), name);
  await fireEvent.press(view.getByText('One-way'));
  await pick(view, 'Start Date', DAY);
  await pick(view, 'Start Time', TIME);
};

const submit = (view: View) => fireEvent.press(view.getByLabelText('Create Trip'));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(createTripWithImage).mockResolvedValue({ id: 7 } as never);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [cover] } as never);
});

describe('CreateTripScreen', () => {
  it('shows all four errors when submitted empty', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());

    await submit(view);

    expect(view.getAllByText('Required')).toHaveLength(3); // name, date, time
    expect(view.getByText('Pick a trip type')).toBeTruthy();
    expect(createTripWithImage).not.toHaveBeenCalled();
  });

  it('clears each error as its field is filled in', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await submit(view);

    await fireEvent.changeText(view.getByLabelText('Enter trip name'), 'Coast Run');
    expect(view.getAllByText('Required')).toHaveLength(2);

    await fireEvent.press(view.getByText('One-way'));
    expect(view.queryByText('Pick a trip type')).toBeNull();

    // Picking either part clears both, since they are checked together
    await pick(view, 'Start Date', DAY);
    expect(view.queryByText('Required')).toBeNull();
  });

  it('leaves an unpicked field empty when the picker is dismissed', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());

    await fireEvent.press(view.getByLabelText('Start Date'));
    await answerPicker('dismissed');
    await fireEvent.press(view.getByText('Done'));

    expect(view.getByLabelText('Start Date')).toBeTruthy();
  });

  it('keeps the picked time when the picker is reopened and dismissed', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await fillForm(view);
    const timeLabel = STARTS_AT.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    await fireEvent.press(view.getByLabelText(timeLabel));
    await answerPicker('dismissed');
    await fireEvent.press(view.getByText('Done'));
    await submit(view);

    await waitFor(() =>
      expect(createTripWithImage).toHaveBeenCalledWith(
        expect.objectContaining({ startsAt: STARTS_AT })
      )
    );
  });

  it('creates the trip with the tidied name, then goes to the trips tab', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await fillForm(view, '  Coast   Run ');

    await submit(view);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/trips'));
    expect(createTripWithImage).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Coast Run',
      tripType: 'one-way',
      startsAt: STARTS_AT,
      image: null,
    });
  });

  it('shows a friendly error and lets the user try again when creation fails', async () => {
    jest.mocked(createTripWithImage).mockRejectedValueOnce({ code: '42501' });
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await fillForm(view);

    await submit(view);

    expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
    expect(view.getByLabelText('Create Trip')).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('asks the user to sign in when there is no user', async () => {
    const view = await renderScreen(<CreateTripScreen />, anonymousAuth);
    await fillForm(view);

    await submit(view);

    expect(view.getByText('You need to be signed in to create a trip.')).toBeTruthy();
    expect(createTripWithImage).not.toHaveBeenCalled();
  });

  it('sends the picked cover image with the trip', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await fireEvent.press(view.getByText('Add cover image (optional)'));
    await view.findByLabelText('Remove cover image');
    await fillForm(view);

    await submit(view);

    await waitFor(() =>
      expect(createTripWithImage).toHaveBeenCalledWith(expect.objectContaining({ image: cover }))
    );
  });

  it('takes the cover image off with the remove button', async () => {
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());
    await fireEvent.press(view.getByText('Add cover image (optional)'));
    await fireEvent.press(await view.findByLabelText('Remove cover image'));

    expect(view.getByText('Add cover image (optional)')).toBeTruthy();

    await fillForm(view);
    await submit(view);

    await waitFor(() =>
      expect(createTripWithImage).toHaveBeenCalledWith(expect.objectContaining({ image: null }))
    );
  });

  it('opens one photo picker however often the box is tapped, until it closes', async () => {
    const picking = deferred<ImagePicker.ImagePickerResult>();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockReturnValueOnce(picking.promise);
    const view = await renderScreen(<CreateTripScreen />, signedInAuth());

    await fireEvent.press(view.getByText('Add cover image (optional)'));
    await fireEvent.press(view.getByText('Add cover image (optional)'));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);

    await act(async () => picking.resolve({ canceled: true, assets: null }));
    await fireEvent.press(view.getByText('Add cover image (optional)'));

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(2);
  });
});
