import { describe, expect, it } from '@jest/globals';
import { colors } from '@/src/constants/theme';
import { availabilityIndicator, type UsernameState } from '../usernameAvailability';

describe('availabilityIndicator', () => {
  it('shows nothing while idle, which also covers "we could not check"', () => {
    expect(availabilityIndicator('idle')).toBeNull();
  });

  it('uses the palette, not raw colours', () => {
    expect(availabilityIndicator('free')?.color).toBe(colors.success);
    expect(availabilityIndicator('taken')?.color).toBe(colors.error);
    expect(availabilityIndicator('checking')?.color).toBe(colors.textMuted);
  });

  it('has an entry for every state', () => {
    const states: UsernameState[] = ['idle', 'checking', 'free', 'taken'];
    for (const state of states) {
      expect(availabilityIndicator(state)).not.toBeUndefined();
    }
  });

  it('labels the two decided states', () => {
    expect(availabilityIndicator('free')?.text).toBe('Available');
    expect(availabilityIndicator('taken')?.text).toBe('Already taken');
  });
});
