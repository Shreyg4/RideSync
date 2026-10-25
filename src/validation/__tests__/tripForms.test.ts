import { describe, expect, it } from '@jest/globals';
import { validateCreateTripForm, normalizeTripName, normalizeJoinCode } from '../tripForms';
import type { CreateTripForm } from '../tripForms';

const NOW = new Date(2026, 8, 2, 9, 30, 0, 0);

const form: CreateTripForm = {
  name: 'Vancouver',
  tripType: 'round-trip',
  startsAt: new Date(2026, 9, 23, 12, 0, 0, 0),
  datePicked: true,
  timePicked: true,
};

describe('validateCreateTripForm', () => {
  it('accepts a valid form', () => {
    expect(validateCreateTripForm(form, NOW)).toEqual({});
  });

  it('requires a trip name, trip type, date, and time', () => {
    const errors = validateCreateTripForm(
      {
        ...form,
        name: '',
        tripType: null,
        startsAt: null,
        datePicked: false,
        timePicked: false,
      },
      NOW
    );
    expect(errors.name).toBe('Required');
    expect(errors.tripType).toBe('Pick a trip type');
    expect(errors.date).toBe('Required');
    expect(errors.time).toBe('Required');
  });

  it('reports that trip name is too short', () => {
    expect(validateCreateTripForm({ ...form, name: 'PH' }, NOW).name).toBe('At least 3 characters');
  });

  it('reports that trip name is too long', () => {
    expect(validateCreateTripForm({ ...form, name: 'a'.repeat(41) }, NOW).name).toBe(
      '40 characters max'
    );
  });

  it('accepts a trip name at exactly the minimum and maximum length', () => {
    expect(validateCreateTripForm({ ...form, name: 'a'.repeat(3) }, NOW).name).toBeUndefined();
    expect(validateCreateTripForm({ ...form, name: 'a'.repeat(40) }, NOW).name).toBeUndefined();
  });

  it('requires only the date when the date is not picked', () => {
    const errors = validateCreateTripForm({ ...form, datePicked: false }, NOW);
    expect(errors.date).toBe('Required');
    expect(errors.time).toBeUndefined();
  });

  it('requires only the time when the time is not picked', () => {
    const errors = validateCreateTripForm({ ...form, timePicked: false }, NOW);
    expect(errors.date).toBeUndefined();
    expect(errors.time).toBe('Required');
  });

  it('requires the date and time when both are marked picked but no date is stored', () => {
    const errors = validateCreateTripForm({ ...form, startsAt: null }, NOW);
    expect(errors.date).toBe('Required');
    expect(errors.time).toBe('Required');
  });

  it('does not report a past date until both the date and time are picked', () => {
    const errors = validateCreateTripForm(
      { ...form, startsAt: new Date(2026, 8, 1, 9, 30, 0, 0), timePicked: false },
      NOW
    );
    expect(errors.date).toBeUndefined();
    expect(errors.time).toBe('Required');
  });

  it('reports that date picked has already passed', () => {
    const errors = validateCreateTripForm(
      { ...form, startsAt: new Date(2026, 8, 1, 9, 30, 0, 0) },
      NOW
    );
    expect(errors.date).toBe('Date is in the past');
    expect(errors.time).toBeUndefined();
  });

  it('reports that time picked has already passed', () => {
    const errors = validateCreateTripForm(
      { ...form, startsAt: new Date(2026, 8, 2, 3, 30, 0, 0) },
      NOW
    );
    expect(errors.date).toBeUndefined();
    expect(errors.time).toBe('Time has already passed');
  });

  it('reports that time picked has already passed when it is exactly equal to current time', () => {
    expect(
      validateCreateTripForm({ ...form, startsAt: new Date(2026, 8, 2, 9, 30, 0, 0) }, NOW).time
    ).toBe('Time has already passed');
  });
});

describe('normalizeTripName', () => {
  it('trims the trip name', () => {
    expect(normalizeTripName(' Vancouver ')).toBe('Vancouver');
    expect(normalizeTripName(' Vancouver   Trip ')).toBe('Vancouver Trip');
  });
});

describe('normalizeJoinCode', () => {
  it('capitalizes code and removes dashes from input', () => {
    expect(normalizeJoinCode('abcd-ef-gh')).toBe('ABCDEFGH');
  });

  it('removes spaces and symbols from code', () => {
    expect(normalizeJoinCode(' ab !e - @se rea')).toBe('ABESEREA');
  });

  it('swaps O to become 0; I and L to become 1', () => {
    expect(normalizeJoinCode('0OI1L234')).toBe('00111234');
  });

  it('swaps lowercase o into 0; I and L into 1 and a short code is not padded', () => {
    expect(normalizeJoinCode('oil')).toBe('011');
  });

  it('cuts to only 8 characters', () => {
    expect(normalizeJoinCode('ABCDEFGHK')).toBe('ABCDEFGH');
  });

  it('removes dashes before cutting, so they do not count toward 8', () => {
    expect(normalizeJoinCode('AB-CD-EF-GH-JK')).toBe('ABCDEFGH');
  });

  it('returns an empty string when nothing is left', () => {
    expect(normalizeJoinCode('')).toBe('');
    expect(normalizeJoinCode('----')).toBe('');
  });
});
