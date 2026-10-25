import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import JoinTripScreen from '../(tabs)/joinTrip';
import { renderScreen, signedInAuth } from '@/src/test/render';
import { mockRpc, mockSupabase } from '@/src/test/supabase';

type View = Awaited<ReturnType<typeof renderScreen>>;

const withParams = (params: Record<string, unknown>) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
};

const typeCode = (view: View, text: string) =>
  fireEvent.changeText(view.getByTestId('join-code-input'), text);

const join = (view: View) => fireEvent.press(view.getByTestId('join-trip-button'));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  withParams({});
});

describe('JoinTripScreen', () => {
  it('keeps Join disabled until the code has all 8 characters', async () => {
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    expect(view.getByTestId('join-trip-button')).toBeDisabled();

    await typeCode(view, 'ABCD234');
    expect(view.getByTestId('join-trip-button')).toBeDisabled();

    await typeCode(view, 'ABCD2345');
    expect(view.getByTestId('join-trip-button')).toBeEnabled();
  });

  it.each([
    ['lowercase', 'abcd2345', 'ABCD-2345'],
    ['dashes, spaces and symbols', 'ab-cd 23.45', 'ABCD-2345'],
    ['O, I and L, which look like 0 and 1', 'oilo1234', '0110-1234'],
    ['anything past 8 characters', 'ABCD2345XYZ', 'ABCD-2345'],
  ])('tidies %s and shows the code as XXXX-XXXX', async (_, typed, shown) => {
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());

    await typeCode(view, typed);

    expect(view.getByTestId('join-code-input')).toHaveDisplayValue(shown);
  });

  it('sends the tidied code without its dash', async () => {
    mockRpc('join_trip', { data: 7 });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    await typeCode(view, 'abcd-o1l2');

    await join(view);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('join_trip', { code: 'ABCD0112' });
  });

  it('says so when the code matches no active trip', async () => {
    mockRpc('join_trip', { error: { code: 'P0002', message: 'invalid invite code' } });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    await typeCode(view, 'ZZZZ9999');

    await join(view);

    await waitFor(() =>
      expect(view.getByTestId('join-trip-error')).toHaveTextContent(
        "That code doesn't match an active trip."
      )
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a friendly error for any other failure', async () => {
    mockRpc('join_trip', { error: { code: '42501', message: 'permission denied' } });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    await typeCode(view, 'ABCD2345');

    await join(view);

    expect(await view.findByText('You do not have permission to do that.')).toBeTruthy();
  });

  it('clears the error as soon as the code is edited', async () => {
    mockRpc('join_trip', { error: { code: 'P0002', message: 'invalid invite code' } });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    await typeCode(view, 'ZZZZ9999');
    await join(view);
    await view.findByTestId('join-trip-error');

    await typeCode(view, 'ZZZZ999');

    expect(view.queryByTestId('join-trip-error')).toBeNull();
  });

  it('opens the trip it joined and clears the input', async () => {
    mockRpc('join_trip', { data: 7 });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());
    await typeCode(view, 'ABCD2345');

    await join(view);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/trips/7'));
    expect(view.getByTestId('join-code-input')).toHaveDisplayValue('');
  });

  it('fills in the code from an invite link', async () => {
    withParams({ code: 'abcd-2345' });
    const view = await renderScreen(<JoinTripScreen />, signedInAuth());

    expect(view.getByTestId('join-code-input')).toHaveDisplayValue('ABCD-2345');
    expect(view.getByTestId('join-trip-button')).toBeEnabled();
  });
});
