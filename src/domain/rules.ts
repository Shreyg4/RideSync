import type { TripType } from '@/src/types/trip';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 20;

export const PASSWORD_MIN_LENGTH = 8;

export const TRIP_TYPES = ['one-way', 'round-trip'] as const satisfies readonly TripType[];

export const TRIP_STATUSES = ['planning', 'in-trip', 'completed'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const tripTypeLabel = (value: TripType) => value.charAt(0).toUpperCase() + value.slice(1);
