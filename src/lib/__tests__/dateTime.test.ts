import { describe, expect, it } from '@jest/globals';
import { addDays, daysBetween, mergeDateTime, startOfDay } from '../dateTime';

const NOW = new Date(2026, 8, 2, 9, 30, 0, 0);

describe('mergeDateTime', () => {
  it('keeps the existing time when only the date is picked', () => {
    const previous = new Date(2026, 0, 1, 14, 45, 0, 0);
    const merged = mergeDateTime(previous, new Date(2026, 6, 10, 3, 3, 3, 3), 'date', NOW);

    expect(merged.getFullYear()).toBe(2026);
    expect(merged.getMonth()).toBe(6);
    expect(merged.getDate()).toBe(10);
    expect(merged.getHours()).toBe(14);
    expect(merged.getMinutes()).toBe(45);
  });

  it('keeps the existing date when only the time is picked', () => {
    const previous = new Date(2026, 0, 1, 14, 45, 0, 0);
    const merged = mergeDateTime(previous, new Date(1999, 11, 31, 7, 5, 0, 0), 'time', NOW);

    expect(merged.getFullYear()).toBe(2026);
    expect(merged.getMonth()).toBe(0);
    expect(merged.getDate()).toBe(1);
    expect(merged.getHours()).toBe(7);
    expect(merged.getMinutes()).toBe(5);
  });

  it('zeroes seconds and milliseconds so two picks compare equal', () => {
    const previous = new Date(2026, 0, 1, 14, 45, 33, 456);
    expect(
      mergeDateTime(previous, new Date(2026, 0, 1, 8, 0, 0, 0), 'time', NOW).getSeconds()
    ).toBe(0);
    expect(
      mergeDateTime(previous, new Date(2026, 0, 1, 8, 0, 0, 0), 'time', NOW).getMilliseconds()
    ).toBe(0);
  });

  it('falls back to the injected clock on the first pick, not the real one', () => {
    const merged = mergeDateTime(null, new Date(2026, 6, 10, 0, 0, 0, 0), 'date', NOW);

    expect(merged.getHours()).toBe(9);
    expect(merged.getMinutes()).toBe(30);
    expect(merged.getDate()).toBe(10);
  });

  it('does not mutate the date it was given', () => {
    const previous = new Date(2026, 0, 1, 14, 45, 0, 0);
    mergeDateTime(previous, new Date(2026, 6, 10, 3, 0, 0, 0), 'date', NOW);

    expect(previous.getMonth()).toBe(0);
    expect(previous.getDate()).toBe(1);
  });
});

describe('calendar days', () => {
  it('starts a day at local midnight', () => {
    expect(startOfDay(new Date(2026, 8, 2, 23, 59))).toEqual(new Date(2026, 8, 2));
  });

  it('adds whole dates across a month and a year', () => {
    expect(addDays(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
    expect(addDays(new Date(2026, 11, 31, 22), 1)).toEqual(new Date(2027, 0, 1));
  });

  // In US time zones, Nov 1 2026 is 25 hours long and Mar 8 2026 is 23
  it('steps over a daylight saving change by one date, not 24 hours', () => {
    expect(addDays(new Date(2026, 9, 31, 23), 1)).toEqual(new Date(2026, 10, 1));
    expect(addDays(new Date(2026, 2, 7, 23), 1)).toEqual(new Date(2026, 2, 8));
    expect(daysBetween(new Date(2026, 9, 31), new Date(2026, 10, 2))).toBe(2);
    expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(2);
  });

  it('counts days by date, whatever the time of day', () => {
    expect(daysBetween(new Date(2026, 8, 2, 23), new Date(2026, 8, 3, 1))).toBe(1);
    expect(daysBetween(new Date(2026, 8, 2, 1), new Date(2026, 8, 2, 23))).toBe(0);
  });
});
