// The last step of adding a stop, so these check what actually gets saved: the place's values from
// Mapbox untouched, plus whatever the user changed, with the stop type the planner worked out.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import StopDetailsScreen from '../trips/[id]/stopDetails';
import { toPlaceParam } from '@/src/lib/placeParam';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockSupabase } from '@/src/test/supabase';
import type { Place } from '@/src/types/trip';

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
