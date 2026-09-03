import { describe, expect, it } from '@jest/globals';
import React from 'react';
import IndexScreen from '../index';
import { anonymousAuth, renderScreen, signedInAuth } from '@/src/test/render';

describe('IndexScreen', () => {
  it('shows the loading state while the stored session is still being read', async () => {
    const view = await renderScreen(<IndexScreen />, { ...anonymousAuth, loading: true });

    expect(view.getByTestId('session-loading')).toBeTruthy();
    expect(view.queryByTestId('redirect')).toBeNull();
  });

  it('sends a signed-in user to the trips tab', async () => {
    const view = await renderScreen(<IndexScreen />, signedInAuth());

    expect(view.getByTestId('redirect')).toHaveTextContent('/trips');
  });

  it('sends a signed-out user to welcome', async () => {
    const view = await renderScreen(<IndexScreen />, anonymousAuth);

    expect(view.getByTestId('redirect')).toHaveTextContent('/welcome');
  });
});
