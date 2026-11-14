import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { RouteSection } from '@/src/domain/route';
import type { RouteSearchPoint } from '@/src/hooks/useRouteSearchPoint';
import RouteSearchPanel, { formatTimeIntoDrive } from '../RouteSearchPanel';

const HIDDEN = { includeHiddenElements: true };

const section = (duration: number, direction: RouteSection['direction'] = 'outbound') =>
  ({
    direction,
    duration,
    firstLeg: 0,
    legs: [],
    line: [],
    distances: [],
    legEnds: [],
  }) as RouteSection;

const searchPoint = (overrides: Partial<RouteSearchPoint> = {}): RouteSearchPoint => ({
  direction: 'outbound',
  setDirection: jest.fn(),
  hasReturn: true,
  section: section(3 * 3600),
  seconds: 5400,
  setSeconds: jest.fn(),
  radiusMiles: 10,
  setRadiusMiles: jest.fn(),
  point: { lat: 0, lng: 0, seconds: 5400, legIndex: 0 },
  ...overrides,
});

const renderPanel = async (search = searchPoint(), extra: Record<string, unknown> = {}) => {
  const onSettled = jest.fn();
  const onDragging = jest.fn();
  const view = await render(
    <RouteSearchPanel search={search} onSettled={onSettled} onDragging={onDragging} {...extra}>
      <Text>Chips go here</Text>
    </RouteSearchPanel>
  );
  return { view, onSettled, onDragging, search };
};

describe('formatTimeIntoDrive', () => {
  it.each([
    [0, '0 min'],
    [45 * 60, '45 min'],
    [105 * 60, '1 h 45 min'],
  ])('shows %d seconds as %s', (seconds, expected) => {
    expect(formatTimeIntoDrive(seconds)).toBe(expected);
  });
});

describe('RouteSearchPanel', () => {
  it('shows nothing until there’s a route', async () => {
    const { view } = await renderPanel(searchPoint({ section: null }));

    expect(view.queryByTestId('route-search-panel')).toBeNull();
  });

  it('puts what to look for under the sliders', async () => {
    const { view } = await renderPanel();

    expect(view.getByTestId('route-search-panel')).toContainElement(
      view.getByText('Chips go here')
    );
  });

  it('offers the way back only when there is one', async () => {
    const oneWay = await renderPanel(searchPoint({ hasReturn: false }));
    expect(oneWay.view.queryByTestId('route-direction-return')).toBeNull();

    const roundTrip = await renderPanel();
    expect(roundTrip.view.getByTestId('route-direction-outbound')).toBeTruthy();
  });

  it('offers the full trip as well as each way', async () => {
    const { view, onSettled, search } = await renderPanel();

    await fireEvent.press(view.getByTestId('route-direction-full'));

    expect(search.setDirection).toHaveBeenCalledWith('full');
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('names the whole trip when searching all of it', async () => {
    const { view } = await renderPanel(searchPoint({ direction: 'full' }));

    expect(view.getByTestId('route-time-slider').props.accessibilityLabel).toBe(
      'Time into the trip'
    );
    expect(view.getByTestId('route-direction-full').props.accessibilityState.selected).toBe(true);
  });

  it('switches the way and says the search should run again', async () => {
    const { view, onSettled, search } = await renderPanel();

    await fireEvent.press(view.getByTestId('route-direction-return'));

    expect(search.setDirection).toHaveBeenCalledWith('return');
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('runs the time slider across the section’s drive', async () => {
    const { view } = await renderPanel();

    expect(view.getByTestId('route-time-slider').props).toMatchObject({
      minimumValue: 0,
      maximumValue: 3 * 3600,
      step: 300,
      disabled: false,
    });
  });

  it('turns the time slider off for a drive of no time', async () => {
    const { view } = await renderPanel(searchPoint({ section: section(0), seconds: 0 }));

    expect(view.getByTestId('route-time-slider').props.disabled).toBe(true);
  });

  it('says it’s dragging while a slider moves, and settled when it’s let go', async () => {
    const { view, onDragging, onSettled, search } = await renderPanel();

    await fireEvent(view.getByTestId('route-time-slider'), 'valueChange', 1800);
    expect(onDragging).toHaveBeenCalled();
    expect(search.setSeconds).toHaveBeenCalledWith(1800);
    expect(onSettled).not.toHaveBeenCalled();

    await fireEvent(view.getByTestId('route-radius-slider'), 'slidingComplete', 15);
    expect(search.setRadiusMiles).toHaveBeenCalledWith(15);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('names the drive home when searching the way back', async () => {
    const { view } = await renderPanel(
      searchPoint({ direction: 'return', section: section(3600, 'return'), seconds: 1800 })
    );

    expect(view.getByTestId('route-time-slider').props.accessibilityLabel).toBe(
      'Time into the drive home'
    );
  });

  it('pads its controls above the phone’s bottom edge', async () => {
    const plain = await renderPanel();
    const inset = await renderPanel(searchPoint(), { bottomInset: 34 });
    const padding = (view: typeof plain.view) =>
      StyleSheet.flatten(view.getByTestId('route-search-panel').props.style).paddingBottom;

    expect(padding(plain.view)).toBe(15);
    expect(padding(inset.view)).toBe(15 + 34);
  });

  it('shows the driving time and radius it’s set to, and nothing more', async () => {
    const { view } = await renderPanel();

    expect(view.getByTestId('route-time-slider-value', HIDDEN)).toHaveTextContent(/^1 h 30 min$/);
    expect(view.getByTestId('route-radius-slider-value', HIDDEN)).toHaveTextContent('10 mi');
  });
});
