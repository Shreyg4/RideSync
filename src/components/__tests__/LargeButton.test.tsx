import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import LargeButton, { type LargeButtonVariant } from '../LargeButton';
import { haptics, type HapticRole } from '@/src/constants/haptics';

describe('LargeButton', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const view = await render(<LargeButton label="Join Trip" onPress={onPress} />);

    await fireEvent.press(view.getByLabelText('Join Trip'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled, and tells a screen reader so', async () => {
    const onPress = jest.fn();
    const haptic = jest.spyOn(haptics, 'action');
    const view = await render(<LargeButton label="Join Trip" onPress={onPress} disabled />);

    await fireEvent.press(view.getByLabelText('Join Trip'));

    expect(onPress).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    expect(view.getByLabelText('Join Trip')).toBeDisabled();
  });

  it('is named by its label, unless given its own accessibility label', async () => {
    const view = await render(
      <LargeButton label="Go" onPress={() => {}} accessibilityLabel="Start the trip" />
    );

    expect(view.getByRole('button', { name: 'Start the trip' })).toBeTruthy();
    expect(view.getByText('Go')).toBeTruthy();
  });

  it.each<[LargeButtonVariant, HapticRole]>([
    ['primary', 'action'],
    ['ghost', 'action'],
    ['dashed', 'action'],
    ['danger', 'destructive'],
  ])('gives a %s button the %s haptic', async (variant, role) => {
    const haptic = jest.spyOn(haptics, role);
    const view = await render(<LargeButton label="Go" variant={variant} onPress={() => {}} />);

    await fireEvent.press(view.getByLabelText('Go'));

    expect(haptic).toHaveBeenCalledTimes(1);
    haptic.mockRestore();
  });
});
