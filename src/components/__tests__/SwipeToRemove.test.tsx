import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SwipeToRemove from '../SwipeToRemove';

const renderRow = (props: Partial<React.ComponentProps<typeof SwipeToRemove>> = {}) =>
  render(
    <SwipeToRemove removeLabel="Remove Diner" onRemove={() => {}} testID="row" {...props}>
      <Text>Diner</Text>
    </SwipeToRemove>
  );

describe('SwipeToRemove', () => {
  it('shows the row with a trash button behind it', async () => {
    const view = await renderRow();

    expect(view.getByText('Diner')).toBeTruthy();
    expect(view.getByLabelText('Remove Diner')).toBeTruthy();
  });

  it('removes from the trash button', async () => {
    const onRemove = jest.fn();
    const view = await renderRow({ onRemove });

    await fireEvent.press(view.getByLabelText('Remove Diner'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and blocks a second press while removing', async () => {
    const view = await renderRow({ removing: true });

    expect(view.getByLabelText('Remove Diner')).toBeDisabled();
    expect(view.getByLabelText('Remove Diner')).toBeBusy();
  });

  it('says when it opens and closes, handing over a way to close it', async () => {
    const onOpen = jest.fn<(methods: { close: () => void }) => void>();
    const onClose = jest.fn();
    const view = await renderRow({ onOpen, onClose });

    await fireEvent.press(view.getByTestId('row-swipe'));
    expect(onOpen).toHaveBeenCalledTimes(1);

    await act(async () => onOpen.mock.calls[0][0].close());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports a touch on the row before the screen sees it', async () => {
    const onTouchStart = jest.fn();
    const view = await renderRow({ onTouchStart });

    await fireEvent(view.getByTestId('row'), 'touchStart');

    expect(onTouchStart).toHaveBeenCalledTimes(1);
  });
});
