import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Settings } from 'lucide-react-native';
import React from 'react';
import SmallButton from '../SmallButton';
import { haptics } from '@/src/constants/haptics';

describe('SmallButton', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const view = await render(
      <SmallButton icon={Settings} onPress={onPress} accessibilityLabel="Trip settings" />
    );

    await fireEvent.press(view.getByLabelText('Trip settings'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // It is icon-only, so the label is the only thing a screen reader can announce
  it('is announced as a button with its label', async () => {
    const view = await render(
      <SmallButton
        icon={Settings}
        onPress={() => {}}
        accessibilityLabel="Trip settings"
        accessibilityHint="Opens the trip's settings"
      />
    );

    expect(view.getByRole('button', { name: 'Trip settings' })).toBeTruthy();
    expect(view.getByHintText("Opens the trip's settings")).toBeTruthy();
  });

  it('gives the action haptic by default, or the one it is given', async () => {
    const action = jest.spyOn(haptics, 'action');
    const destructive = jest.spyOn(haptics, 'destructive');
    const view = await render(
      <>
        <SmallButton icon={Settings} onPress={() => {}} accessibilityLabel="Settings" />
        <SmallButton
          icon={Settings}
          onPress={() => {}}
          accessibilityLabel="Delete"
          haptic="destructive"
        />
      </>
    );

    await fireEvent.press(view.getByLabelText('Settings'));
    expect(action).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByLabelText('Delete'));
    expect(destructive).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);

    action.mockRestore();
    destructive.mockRestore();
  });
});
