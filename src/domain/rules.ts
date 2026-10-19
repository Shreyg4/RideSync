/**
 * @file rules.ts
 * @description The app's single source of truth for the values that dfine
 * what's valid or allowed.
 */
import type { TripType, TripMemberRole, TripMember } from '@/src/types/trip';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 20;

export const PASSWORD_MIN_LENGTH = 8;

export const TRIP_TYPES = ['one-way', 'round-trip'] as const satisfies readonly TripType[];
export const TRIP_NAME_MIN_LENGTH = 3;
export const TRIP_NAME_MAX_LENGTH = 40;

export const TRIP_STATUSES = ['planning', 'in-trip', 'completed'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const tripTypeLabel = (value: TripType) => value.charAt(0).toUpperCase() + value.slice(1);
export const tripStatusLabel = (value: TripStatus) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replace('-', ' ');

export const JOIN_CODE_LENGTH = 8;

export const formatJoinCode = (code: string) =>
  code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

export const memberRoleLabel = (value: TripMemberRole) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const nextOwner = (members: readonly TripMember[]): TripMember | undefined =>
  members.find((member) => member.role === 'editor') ??
  members.find((member) => member.role === 'viewer');
