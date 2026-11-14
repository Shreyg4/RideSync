import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import LabeledSlider, { snapToStep } from '../LabeledSlider';

const minutes = (value: number) => `${value} min`;

// The labels above the slider are hidden from screen readers, which hear the slider itself
const HIDDEN = { includeHiddenElements: true };

const renderSlider = async (
  overrides: Partial<React.ComponentProps<typeof LabeledSlider>> = {}
) => {
  const onValueChange = jest.fn();
  const onSlidingComplete = jest.fn();
  const view = await render(
    <LabeledSlider
      label="Time into the drive"
      value={30}
      minimumValue={0}
      maximumValue={120}
      step={5}
      formatValue={minutes}
      onValueChange={onValueChange}
      onSlidingComplete={onSlidingComplete}
      testID="time-slider"
      {...overrides}
    />
  );
  return { view, onValueChange, onSlidingComplete };
};

describe('snapToStep', () => {
  it.each([
    [32, 30],
    [33, 35],
    [0.30000000000000004, 0],
  ])('puts %d on the nearest step, %d', (value, expected) => {
    expect(snapToStep(value, 0, 120, 5)).toBe(expected);
  });

  it('counts steps from the minimum, not from zero', () => {
    expect(snapToStep(4, 2, 25, 1)).toBe(4);
    expect(snapToStep(3.6, 2, 25, 1)).toBe(4);
    expect(snapToStep(7, 1, 20, 3)).toBe(7);
  });

  it('keeps values inside the range', () => {
    expect(snapToStep(-10, 0, 120, 5)).toBe(0);
    expect(snapToStep(500, 0, 120, 5)).toBe(120);
  });

  it('keeps the minimum when the range is empty, like a drive of no time', () => {
    expect(snapToStep(30, 0, 0, 5)).toBe(0);
  });
});

describe('LabeledSlider', () => {
  it('shows its label and its value', async () => {
    const { view } = await renderSlider();

    expect(view.getByText('Time into the drive', HIDDEN)).toBeTruthy();
    expect(view.getByTestId('time-slider-value', HIDDEN)).toHaveTextContent('30 min');
  });

  it('gives the slider its range and step', async () => {
    const { view } = await renderSlider();

    expect(view.getByTestId('time-slider').props).toMatchObject({
      value: 30,
      minimumValue: 0,
      maximumValue: 120,
      step: 5,
    });
  });

  it('reports each step while dragging, snapped to the steps', async () => {
    const { view, onValueChange, onSlidingComplete } = await renderSlider();

    await fireEvent(view.getByTestId('time-slider'), 'valueChange', 46.9999);

    expect(onValueChange).toHaveBeenCalledWith(45);
    expect(onSlidingComplete).not.toHaveBeenCalled();
  });

  it('reports once more when the thumb is let go', async () => {
    const { view, onSlidingComplete } = await renderSlider();

    await fireEvent(view.getByTestId('time-slider'), 'slidingComplete', 60.2);

    expect(onSlidingComplete).toHaveBeenCalledWith(60);
  });

  it('moves the slider back to 0 when told to, which the library would otherwise ignore', async () => {
    const { view } = await renderSlider({ value: 0 });

    const { value } = view.getByTestId('time-slider').props;
    expect(value).toBeGreaterThan(0);
    expect(snapToStep(value, 0, 120, 5)).toBe(0);
    expect(view.getByTestId('time-slider-value', HIDDEN)).toHaveTextContent('0 min');
  });

  it('shows a value the caller gives outside the range as the nearest end', async () => {
    const { view } = await renderSlider({ value: 999 });

    expect(view.getByTestId('time-slider-value', HIDDEN)).toHaveTextContent('120 min');
  });

  describe('with a screen reader', () => {
    it('is announced as adjustable, by its label and formatted value', async () => {
      const { view } = await renderSlider();
      const slider = view.getByTestId('time-slider');

      expect(slider.props.accessibilityRole).toBe('adjustable');
      expect(slider.props.accessibilityLabel).toBe('Time into the drive');
      expect(slider.props.accessibilityValue).toEqual({ text: '30 min' });
    });

    it.each([
      ['increment', 35],
      ['decrement', 25],
    ])('steps on %s, as both a move and a release', async (actionName, expected) => {
      const { view, onValueChange, onSlidingComplete } = await renderSlider();

      await fireEvent(view.getByTestId('time-slider'), 'accessibilityAction', {
        nativeEvent: { actionName },
      });

      expect(onValueChange).toHaveBeenCalledWith(expected);
      expect(onSlidingComplete).toHaveBeenCalledWith(expected);
    });

    it('does nothing past either end', async () => {
      const { view, onValueChange } = await renderSlider({ value: 120 });

      await fireEvent(view.getByTestId('time-slider'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it('can be turned off', async () => {
    const { view } = await renderSlider({ disabled: true });

    expect(view.getByTestId('time-slider').props.disabled).toBe(true);
  });
});
