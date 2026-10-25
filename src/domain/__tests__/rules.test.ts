import { describe, expect, it } from '@jest/globals';
import type { TripMember, TripMemberRole } from '@/src/types/trip';
import {
  nextOwner,
  memberRoleLabel,
  formatJoinCode,
  tripTypeLabel,
  tripStatusLabel,
} from '../rules';

const member = (name: string, role: TripMemberRole): TripMember => ({
  id: name.toLowerCase(),
  name,
  avatar: null,
  role,
});

describe('nextOwner', () => {
  it('picks the first editor even when a viewer joined earlier', () => {
    const members = [
      member('Ana', 'owner'),
      member('Bea', 'viewer'),
      member('Cal', 'editor'),
      member('Sam', 'editor'),
    ];
    expect(nextOwner(members)?.name).toBe('Cal');
  });

  it('falls back to the first viewer when there are no editors', () => {
    const members = [member('Ana', 'owner'), member('Bea', 'viewer'), member('cal', 'viewer')];
    expect(nextOwner(members)?.name).toBe('Bea');
  });

  it('returns undefined for an owner-only list or an empty list', () => {
    expect(nextOwner([member('Ana', 'owner')])).toBeUndefined();
    expect(nextOwner([])).toBeUndefined();
  });
});

describe('memberRoleLabel', () => {
  it('capitalizes each role', () => {
    expect(memberRoleLabel('owner')).toBe('Owner');
    expect(memberRoleLabel('editor')).toBe('Editor');
    expect(memberRoleLabel('viewer')).toBe('Viewer');
  });
});

describe('formatJoinCode', () => {
  it('Adds dash after the 4th character', () => {
    expect(formatJoinCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('leaves a code of 4 characters or fewer unchanged', () => {
    expect(formatJoinCode('ABCD')).toBe('ABCD');
    expect(formatJoinCode('AB')).toBe('AB');
    expect(formatJoinCode('')).toBe('');
  });
});

describe('tripTypeLabel', () => {
  it('Capitalizes trip type', () => {
    expect(tripTypeLabel('one-way')).toBe('One-way');
    expect(tripTypeLabel('round-trip')).toBe('Round-trip');
  });
});

describe('tripStatusLabel', () => {
  it('Formats trip status label to be capitlized and replace dash with a space', () => {
    expect(tripStatusLabel('in-trip')).toBe('In trip');
  });

  it('capitalizes statuses that have no dash', () => {
    expect(tripStatusLabel('planning')).toBe('Planning');
    expect(tripStatusLabel('completed')).toBe('Completed');
  });
});
