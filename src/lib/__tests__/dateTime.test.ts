import { describe, expect, it } from '@jest/globals';
import { mergeDateTime } from '../dateTime';

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
