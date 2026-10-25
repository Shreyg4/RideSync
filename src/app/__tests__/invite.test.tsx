import { describe, expect, it, jest } from '@jest/globals';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import InviteScreen from '../invite/[code]';
import { renderScreen, signedInAuth } from '@/src/test/render';

describe('InviteScreen', () => {
  it('hands the code from the link to the join screen', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'ABCD2345' });

    const view = await renderScreen(<InviteScreen />, signedInAuth());

    expect(view.getByTestId('redirect')).toHaveTextContent(
      JSON.stringify({ pathname: '/joinTrip', params: { code: 'ABCD2345' } })
    );
  });
});
