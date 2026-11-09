// The last step of adding a stop, so these check what actually gets saved: the place's values from
// Mapbox untouched, plus whatever the user changed, with the stop type the planner worked out.
// The same screen edits a saved stop, so the second half checks what an edit sends, and what each
// kind of stop and member is allowed to change.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import StopDetailsScreen from '../trips/[id]/stopDetails';
import { toPlaceParam } from '@/src/lib/placeParam';
import type { TripRow } from '@/src/services/tripService';
import type { TripStopRow } from '@/src/services/tripStopService';
import { lastAlert, mockAlert, pressAlertButton } from '@/src/test/alert';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockSupabase, mockTable } from '@/src/test/supabase';
import type { Place } from '@/src/types/trip';

// A component that renders nothing, so a test can read the props the screen gave it
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  DateTimePickerAndroid: { open: jest.fn() },
}));

const PLACE: Place = {
  mapboxId: 'needle-retrieved',
  name: 'Space Needle',
  address: '400 Broad Street, Seattle',
  lat: 47.6205,
  lng: -122.3493,
  category: 'attraction',
};

const renderStopDetails = async (params: Record<string, string | undefined> = {}) => {
  // The router has already undone the param's encoding by the time a screen reads it
  const place = decodeURIComponent(toPlaceParam(PLACE));
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    id: '1',
    place,
    stopType: 'stop',
    ...params,
  });
  return renderScreen(<StopDetailsScreen />, signedInAuth());
};

type View = Awaited<ReturnType<typeof renderStopDetails>>;

const save = async (view: View) => {
  await fireEvent.press(view.getByTestId('stop-save-button'));
};

// The args of the one add_trip_stop call this screen should have made
const savedStop = () => {
  const calls = mockSupabase.rpc.mock.calls.filter(([name]) => name === 'add_trip_stop');
  expect(calls).toHaveLength(1);
  return calls[0][1] as Record<string, unknown>;
};

const addCalls = () => mockSupabase.rpc.mock.calls.filter(([name]) => name === 'add_trip_stop');

beforeEach(() => {
  (router.dismissTo as jest.Mock).mockClear();
  mockRpc('add_trip_stop', { data: { id: 9 } });
});

describe('StopDetailsScreen preview', () => {
  it('starts with the name and address from Mapbox', async () => {
    const view = await renderStopDetails();

    expect(view.getByTestId('stop-name-input').props.value).toBe('Space Needle');
    expect(view.getByText('400 Broad Street, Seattle')).toBeTruthy();
  });

  it('puts the pin and the map on the place, longitude first', async () => {
    const view = await renderStopDetails();

    expect(view.getByTestId('stop-details-pin').props.coordinate).toEqual([-122.3493, 47.6205]);
    expect(view.getByTestId('mapbox-camera').props.defaultSettings.centerCoordinate).toEqual([
      -122.3493, 47.6205,
    ]);
  });

  it('keeps the map from taking drags away from the form', async () => {
    const view = await renderStopDetails();

    expect(view.getByTestId('stop-details-map-box').props.pointerEvents).toBe('none');
  });

  it('leaves the address out for a place without one', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: '1',
      place: JSON.stringify({ ...PLACE, address: null }),
      stopType: 'stop',
    });

    const view = await renderScreen(<StopDetailsScreen />, signedInAuth());

    expect(view.queryByText('400 Broad Street, Seattle')).toBeNull();
  });

  it('explains itself instead of showing a form when the place is unreadable', async () => {
    const view = await renderStopDetails({ place: 'not json' });

    expect(view.getByText("Couldn't open that place")).toBeTruthy();
    expect(view.queryByTestId('stop-save-button')).toBeNull();
  });

  it.each([
    ['start', 'Set start'],
    ['end', 'Set end'],
    ['destination', 'Set destination'],
    ['stop', 'Add stop'],
  ])('labels a %s stop\'s save button "%s"', async (stopType, label) => {
    const view = await renderStopDetails({ stopType });

    expect(view.getByTestId('stop-save-button').props.accessibilityLabel).toBe(label);
  });
});

describe('StopDetailsScreen category', () => {
  const isSelected = (view: View, category: string) =>
    view.getByTestId(`stop-category-${category}`).props.accessibilityState.selected;

  it('offers all seven categories, with the one from Mapbox already selected', async () => {
    const view = await renderStopDetails();

    for (const category of ['gas', 'food', 'coffee', 'rest', 'lodging', 'other']) {
      expect(isSelected(view, category)).toBe(false);
    }
    expect(isSelected(view, 'attraction')).toBe(true);
  });

  it('saves the category the user picks instead', async () => {
    const view = await renderStopDetails();

    await fireEvent.press(view.getByTestId('stop-category-food'));
    expect(isSelected(view, 'food')).toBe(true);
    expect(isSelected(view, 'attraction')).toBe(false);

    await save(view);
    await waitFor(() => expect(savedStop().stop_category).toBe('food'));
  });
});

describe('StopDetailsScreen stop type', () => {
  it('saves a normal stop by default', async () => {
    const view = await renderStopDetails();

    await save(view);

    await waitFor(() => expect(savedStop().new_stop_type).toBe('stop'));
  });

  it('saves an overnight stop when the switch is on', async () => {
    const view = await renderStopDetails();

    await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', true);
    await save(view);

    await waitFor(() => expect(savedStop().new_stop_type).toBe('overnight'));
  });

  it.each(['start', 'end'])('saves a %s stop as itself, with no overnight switch', async (type) => {
    const view = await renderStopDetails({ stopType: type });

    expect(view.queryByTestId('stop-overnight-switch')).toBeNull();

    await save(view);
    await waitFor(() =>
      expect(savedStop()).toMatchObject({ new_stop_type: type, stop_is_turnaround: false })
    );
  });

  it('saves a destination as a normal stop marked as the turnaround', async () => {
    const view = await renderStopDetails({ stopType: 'destination' });

    await save(view);

    await waitFor(() =>
      expect(savedStop()).toMatchObject({ new_stop_type: 'stop', stop_is_turnaround: true })
    );
  });

  it('lets the group stay the night at their destination', async () => {
    const view = await renderStopDetails({ stopType: 'destination' });

    await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', true);
    await save(view);

    await waitFor(() =>
      expect(savedStop()).toMatchObject({ new_stop_type: 'overnight', stop_is_turnaround: true })
    );
  });

  it('never marks a normal stop as the turnaround', async () => {
    const view = await renderStopDetails();

    await save(view);

    await waitFor(() => expect(savedStop().stop_is_turnaround).toBe(false));
  });
});

describe('StopDetailsScreen saving', () => {
  it('saves the coordinates, id and address exactly as Mapbox gave them', async () => {
    const view = await renderStopDetails();

    await save(view);

    await waitFor(() =>
      expect(savedStop()).toEqual({
        target_trip_id: 1,
        stop_name: 'Space Needle',
        stop_lat: 47.6205,
        stop_lng: -122.3493,
        stop_address: '400 Broad Street, Seattle',
        stop_mapbox_id: 'needle-retrieved',
        new_stop_type: 'stop',
        stop_category: 'attraction',
        stop_notes: undefined,
        at_position: undefined,
        stop_is_turnaround: false,
      })
    );
  });

  it('closes the preview and the search together, back to the planner', async () => {
    const view = await renderStopDetails();

    await save(view);

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips/1/planner'));
  });

  it('saves an edited name and notes without their outer spaces', async () => {
    const view = await renderStopDetails();

    await fireEvent.changeText(view.getByTestId('stop-name-input'), '  The Needle ');
    await fireEvent.changeText(view.getByTestId('stop-notes-input'), ' Buy tickets first ');
    await save(view);

    await waitFor(() =>
      expect(savedStop()).toMatchObject({
        stop_name: 'The Needle',
        stop_notes: 'Buy tickets first',
      })
    );
  });

  it('saves notes of only spaces as no notes', async () => {
    const view = await renderStopDetails();

    await fireEvent.changeText(view.getByTestId('stop-notes-input'), '   ');
    await save(view);

    await waitFor(() => expect(savedStop().stop_notes).toBeUndefined());
  });

  it('passes on the position it was asked to insert at', async () => {
    const view = await renderStopDetails({ atPosition: '3' });

    await save(view);

    await waitFor(() => expect(savedStop().at_position).toBe(3));
  });

  it('ignores an unusable position', async () => {
    const view = await renderStopDetails({ atPosition: 'soon' });

    await save(view);

    await waitFor(() => expect(savedStop().at_position).toBeUndefined());
  });

  it('asks for a name instead of saving without one, and clears the error once typing starts', async () => {
    const view = await renderStopDetails();

    await fireEvent.changeText(view.getByTestId('stop-name-input'), '   ');
    await save(view);

    expect(view.getByTestId('stop-name-error')).toBeTruthy();
    expect(addCalls()).toHaveLength(0);
    expect(router.dismissTo).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId('stop-name-input'), 'N');
    expect(view.queryByTestId('stop-name-error')).toBeNull();
  });

  it('stays open with a readable message when the save fails, and allows another try', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc('add_trip_stop', { data: null, error: { code: '42501', message: 'nope' } });
    const view = await renderStopDetails();

    await save(view);

    expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(view.getByTestId('stop-save-button').props.accessibilityState.disabled).toBe(false)
    );
    mockRpc('add_trip_stop', { data: { id: 9 } });
    await save(view);

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips/1/planner'));
    expect(view.queryByTestId('stop-save-error')).toBeNull();
  });

  it('blocks a second tap while the save is running, so it cannot add the stop twice', async () => {
    let finish!: (value: { data: unknown; error: null }) => void;
    mockSupabase.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }) as never
    );
    const view = await renderStopDetails();

    await save(view);
    await waitFor(() =>
      expect(view.getByTestId('stop-save-button').props.accessibilityState.disabled).toBe(true)
    );
    await save(view);

    expect(addCalls()).toHaveLength(1);

    finish({ data: { id: 9 }, error: null });
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledTimes(1));
  });
});

// ---- Editing a saved stop ----

// Wed, Sep 2 2026, so the group reaches every day-1 stop that day
const STARTS_AT = new Date(2026, 8, 2, 9, 30);
const NOW = STARTS_AT.toISOString();

const tripRow = (overrides: Partial<TripRow> = {}): TripRow => ({
  created_at: NOW,
  id: 1,
  image_url: null,
  invite_link: 'ABCD2345',
  name: 'Coast Run',
  owner_id: 'user-1',
  starts_at: NOW,
  trip_status: 'planning',
  trip_type: 'one-way',
  updated_at: NOW,
  ...overrides,
});

const stopRow = (overrides: Partial<TripStopRow> = {}): TripStopRow => ({
  id: 2,
  trip_id: 1,
  position: 1,
  name: 'Diner',
  address: '1 Main St, Ellensburg',
  lat: 47.0,
  lng: -120.5,
  mapbox_id: 'diner-id',
  stop_type: 'stop',
  category: 'food',
  notes: 'Try the pie',
  departs_at: null,
  is_turnaround: false,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const START = stopRow({ id: 1, position: 0, name: 'Home', stop_type: 'start', notes: null });
const END = stopRow({ id: 3, position: 2, name: 'Coast', stop_type: 'end', notes: null });

const member = (role: string) => ({
  user_id: 'user-1',
  display_name: 'Ana',
  role,
  avatar_path: '',
  joined_at: NOW,
});

type EditOptions = {
  role?: string;
  stop?: TripStopRow;
  stops?: TripStopRow[];
  trip?: TripRow;
  params?: Record<string, string>;
};

const renderEdit = async ({
  role = 'owner',
  stop = stopRow(),
  stops = [START, stop, END],
  trip = tripRow(),
  params = {},
}: EditOptions = {}) => {
  mockTable('trips').__setResult({ data: trip, error: null });
  mockTable('trip_stops').__setResult({ data: stops, error: null });
  mockRpc('list_trip_members', { data: [member(role)] });
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    id: '1',
    stopId: String(stop.id),
    ...params,
  });
  const view = await renderScreen(<StopDetailsScreen />, signedInAuth());
  await waitFor(() => expect(view.queryByTestId('stop-details-loading')).toBeNull());
  return view;
};

// What the one update to trip_stops changed
const savedChanges = () => {
  const calls = mockTable('trip_stops').update.mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0] as Record<string, unknown>;
};

type PickerProps = {
  onChange: (event: DateTimePickerEvent, value?: Date) => void;
  value: Date;
  minimumDate?: Date;
};

const pickerProps = () =>
  (DateTimePicker as unknown as jest.Mock).mock.calls.at(-1)?.[0] as PickerProps;

const pickDeparture = async (view: View, field: 'date' | 'time', value: Date) => {
  await fireEvent.press(view.getByTestId(`stop-departure-${field}`));
  await act(async () =>
    pickerProps().onChange(
      { type: 'set', nativeEvent: { timestamp: value.getTime(), utcOffset: 0 } },
      value
    )
  );
  await fireEvent.press(view.getByText('Done'));
};

describe('StopDetailsScreen editing a stop', () => {
  beforeEach(() => {
    mockAlert();
    (router.push as jest.Mock).mockClear();
    (DateTimePicker as unknown as jest.Mock).mockClear();
  });

  it('opens the saved stop with its own name, category and notes', async () => {
    const view = await renderEdit();

    expect(view.getByText('Edit Stop')).toBeTruthy();
    expect(view.getByTestId('stop-name-input').props.value).toBe('Diner');
    expect(view.getByTestId('stop-category-food').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('stop-notes-input').props.value).toBe('Try the pie');
    expect(view.getByText('1 Main St, Ellensburg')).toBeTruthy();
    expect(view.getByTestId('stop-details-pin').props.coordinate).toEqual([-120.5, 47.0]);
  });

  it('saves the changes over the stop without touching its place, then goes back to the planner', async () => {
    const view = await renderEdit();

    await fireEvent.changeText(view.getByTestId('stop-name-input'), ' Diner & Pie ');
    await fireEvent.press(view.getByTestId('stop-category-coffee'));
    await save(view);

    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips/1/planner'));
    expect(savedChanges()).toEqual({
      name: 'Diner & Pie',
      category: 'coffee',
      notes: 'Try the pie',
      stop_type: 'stop',
      departs_at: null,
    });
    expect(mockTable('trip_stops').eq).toHaveBeenCalledWith('id', 2);
    expect(addCalls()).toHaveLength(0);
  });

  it('clears notes that were emptied', async () => {
    const view = await renderEdit();

    await fireEvent.changeText(view.getByTestId('stop-notes-input'), '  ');
    await save(view);

    await waitFor(() => expect(savedChanges().notes).toBeNull());
  });

  it('shows why a save failed, such as the stop being gone or edit rights lost', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = await renderEdit();
    // RLS skips the write without an error, so no changed rows comes back
    mockTable('trip_stops').__setResult({ data: [], error: null });

    await save(view);

    expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('says so when the stop is no longer on the trip', async () => {
    const view = await renderEdit({ stops: [START, END] });

    expect(view.getByText('This stop is no longer on the trip')).toBeTruthy();
    expect(view.queryByTestId('stop-save-button')).toBeNull();
  });

  describe('overnight', () => {
    it('makes a stop overnight, leaving the next morning by default', async () => {
      const view = await renderEdit();

      await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', true);
      expect(view.getByText('Leaves the next morning')).toBeTruthy();
      await save(view);

      await waitFor(() =>
        expect(savedChanges()).toMatchObject({ stop_type: 'overnight', departs_at: null })
      );
    });

    it('opens the pickers on the morning after arrival, and allows no earlier day', async () => {
      const view = await renderEdit();
      await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', true);

      await fireEvent.press(view.getByTestId('stop-departure-date'));

      expect(pickerProps().value).toEqual(new Date(2026, 8, 3, 9, 0));
      expect(pickerProps().minimumDate).toEqual(new Date(2026, 8, 3));
    });

    it('saves the departure date and time the user picks', async () => {
      const view = await renderEdit();
      await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', true);

      await pickDeparture(view, 'date', new Date(2026, 8, 4));
      await pickDeparture(view, 'time', new Date(2000, 0, 1, 7, 15));
      await save(view);

      await waitFor(() =>
        expect(savedChanges()).toMatchObject({
          stop_type: 'overnight',
          departs_at: new Date(2026, 8, 4, 7, 15).toISOString(),
        })
      );
    });

    it('keeps an overnight stop’s departure, and can clear it back to the next morning', async () => {
      const departs = new Date(2026, 8, 3, 8, 0);
      const view = await renderEdit({
        stop: stopRow({ stop_type: 'overnight', departs_at: departs.toISOString() }),
      });

      expect(view.getByTestId('stop-overnight-switch').props.value).toBe(true);
      expect(view.getByTestId('stop-departure-clear')).toBeTruthy();

      await fireEvent.press(view.getByTestId('stop-departure-clear'));
      await save(view);

      await waitFor(() =>
        expect(savedChanges()).toMatchObject({ stop_type: 'overnight', departs_at: null })
      );
    });

    it('drops the departure when the stop is no longer overnight', async () => {
      const view = await renderEdit({
        stop: stopRow({
          stop_type: 'overnight',
          departs_at: new Date(2026, 8, 3, 8, 0).toISOString(),
        }),
      });

      await fireEvent(view.getByTestId('stop-overnight-switch'), 'valueChange', false);
      expect(view.queryByTestId('stop-departure-date')).toBeNull();
      await save(view);

      await waitFor(() =>
        expect(savedChanges()).toMatchObject({ stop_type: 'stop', departs_at: null })
      );
    });
  });

  describe('which stops can change type or be removed', () => {
    it.each([
      ['start', START],
      ['end', END],
    ])('keeps the %s’s type: no overnight switch, no remove, none sent', async (_, stop) => {
      const view = await renderEdit({ stop });

      expect(view.queryByTestId('stop-overnight-switch')).toBeNull();
      expect(view.queryByTestId('stop-remove-button')).toBeNull();
      expect(view.getByTestId('stop-change-place')).toBeTruthy();

      await save(view);
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalled());
      expect(savedChanges()).not.toHaveProperty('stop_type');
      expect(savedChanges()).not.toHaveProperty('departs_at');
    });

    it('lets the destination stay overnight but not be removed', async () => {
      const destination = stopRow({ is_turnaround: true });
      const view = await renderEdit({
        stop: destination,
        stops: [START, destination],
        trip: tripRow({ trip_type: 'round-trip' }),
      });

      expect(view.getByTestId('stop-overnight-switch')).toBeTruthy();
      expect(view.queryByTestId('stop-remove-button')).toBeNull();
    });
  });

  describe('removing', () => {
    it('asks first, then removes the stop and goes back to the planner', async () => {
      const view = await renderEdit();

      await fireEvent.press(view.getByTestId('stop-remove-button'));
      expect(lastAlert().title).toBe('Remove Diner?');
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('remove_trip_stop', expect.anything());

      await pressAlertButton('Remove');

      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/trips/1/planner'));
      expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_trip_stop', { target_stop_id: 2 });
    });

    it('does nothing when the user cancels', async () => {
      const view = await renderEdit();

      await fireEvent.press(view.getByTestId('stop-remove-button'));
      await pressAlertButton('Cancel');

      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('remove_trip_stop', expect.anything());
      expect(router.dismissTo).not.toHaveBeenCalled();
    });

    it('stays open with a message when the remove fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockRpc('remove_trip_stop', { error: { code: '42501', message: 'nope' } });
      const view = await renderEdit();

      await fireEvent.press(view.getByTestId('stop-remove-button'));
      await pressAlertButton('Remove');

      expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
      expect(router.dismissTo).not.toHaveBeenCalled();
    });
  });

  describe('changing the place', () => {
    it.each([
      ['a normal stop', stopRow(), 'stop'],
      ['the start', START, 'start'],
      [
        'an overnight destination',
        stopRow({ stop_type: 'overnight', is_turnaround: true }),
        'destination',
      ],
    ])('opens search for %s, carrying which stop moves', async (_, stop, stopType) => {
      const view = await renderEdit({ stop, trip: tripRow({ trip_type: 'round-trip' }) });

      await fireEvent.press(view.getByTestId('stop-change-place'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/trips/[id]/addStop',
        params: { id: 1, stopType, stopId: stop.id },
      });
    });

    const renderMove = (options: EditOptions = {}) =>
      renderEdit({ ...options, params: { place: decodeURIComponent(toPlaceParam(PLACE)) } });

    it('previews the new place with its name and category, keeping the stop’s notes', async () => {
      const view = await renderMove();

      expect(view.getByText('Change Place')).toBeTruthy();
      expect(view.getByTestId('stop-name-input').props.value).toBe('Space Needle');
      expect(view.getByTestId('stop-category-attraction').props.accessibilityState.selected).toBe(
        true
      );
      expect(view.getByTestId('stop-notes-input').props.value).toBe('Try the pie');
      expect(view.getByTestId('stop-details-pin').props.coordinate).toEqual([-122.3493, 47.6205]);
      // It's already a move, so there's nothing to move or remove from here
      expect(view.queryByTestId('stop-change-place')).toBeNull();
      expect(view.queryByTestId('stop-remove-button')).toBeNull();
    });

    it('saves the new place over the stop, exactly as Mapbox gave it', async () => {
      const view = await renderMove();

      await save(view);

      await waitFor(() =>
        expect(savedChanges()).toEqual({
          name: 'Space Needle',
          category: 'attraction',
          notes: 'Try the pie',
          lat: 47.6205,
          lng: -122.3493,
          address: '400 Broad Street, Seattle',
          mapbox_id: 'needle-retrieved',
          stop_type: 'stop',
          departs_at: null,
        })
      );
      expect(addCalls()).toHaveLength(0);
      expect(router.dismissTo).toHaveBeenCalledWith('/trips/1/planner');
    });

    it('moves the start without sending it a type', async () => {
      const view = await renderMove({ stop: START });

      await save(view);

      await waitFor(() => expect(savedChanges()).toMatchObject({ lat: 47.6205, lng: -122.3493 }));
      expect(savedChanges()).not.toHaveProperty('stop_type');
    });
  });

  describe('as a viewer', () => {
    it('shows the stop with nothing to change', async () => {
      const view = await renderEdit({ role: 'viewer' });

      expect(view.getByTestId('stop-summary-name').props.children).toBe('Diner');
      expect(view.getByText('Food')).toBeTruthy();
      expect(view.getByText('Try the pie')).toBeTruthy();
      expect(view.queryByTestId('stop-name-input')).toBeNull();
      expect(view.queryByTestId('stop-save-button')).toBeNull();
      expect(view.queryByTestId('stop-remove-button')).toBeNull();
      expect(view.queryByTestId('stop-change-place')).toBeNull();
    });

    it('tells a viewer when the group leaves an overnight stop', async () => {
      const departs = new Date(2026, 8, 3, 8, 0);
      const view = await renderEdit({
        role: 'viewer',
        stop: stopRow({ stop_type: 'overnight', departs_at: departs.toISOString() }),
      });

      expect(view.getByTestId('stop-summary-departure').props.children).toContain('Leaves ');
      expect(view.getByTestId('stop-summary-departure').props.children).not.toBe(
        'Leaves the next morning'
      );
    });
  });
});
