import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Calendar } from 'lucide-react-native';
import React from 'react';
import FieldButton from '../FieldButton';
import { haptics } from '@/src/constants/haptics';

describe('FieldButton', () => {
  it('shows its placeholder, and is named by it, while there is no value', async () => {
    const view = await render(
      <FieldButton text={null} placeholder="Start Date" icon={Calendar} onPress={() => {}} />
    );

    expect(view.getByText('Start Date')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Start Date' })).toBeTruthy();
  });

  it('shows the value, and is named by it, once there is one', async () => {
    const view = await render(
      <FieldButton text="Mon, Jun 1" placeholder="Start Date" onPress={() => {}} />
    );

    expect(view.getByText('Mon, Jun 1')).toBeTruthy();
    expect(view.queryByText('Start Date')).toBeNull();
    expect(view.getByRole('button', { name: 'Mon, Jun 1' })).toBeTruthy();
  });

  it('calls onPress with the light selection haptic', async () => {
    const onPress = jest.fn();
    const selection = jest.spyOn(haptics, 'selection');
    const view = await render(
      <FieldButton text={null} placeholder="Start Time" onPress={onPress} />
    );

    await fireEvent.press(view.getByLabelText('Start Time'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(selection).toHaveBeenCalledTimes(1);
    selection.mockRestore();
  });
});
