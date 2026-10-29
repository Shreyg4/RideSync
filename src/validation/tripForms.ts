/**
 * @file tripFroms.ts
 * @description This file holds everything about the create-trip form that can be tested
 * without rendering a screen.
 */

import { TRIP_NAME_MIN_LENGTH, TRIP_NAME_MAX_LENGTH, JOIN_CODE_LENGTH } from '../domain/rules';
import type { TripType } from '../types/trip';

export type CreateTripForm = {
  name: string;
  tripType: TripType | null;
  startsAt: Date | null;
  datePicked: boolean;
  timePicked: boolean;
};

export type CreateTripFieldErrors = Partial<Record<'name' | 'tripType' | 'date' | 'time', string>>;

export const normalizeTripName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const validateCreateTripForm = (
  form: CreateTripForm,
  now = new Date(),
  originalStartsAt?: Date | null
) => {
  const next: CreateTripFieldErrors = {};
  if (!form.name) next.name = 'Required';
  else if (form.name.length < TRIP_NAME_MIN_LENGTH)
    next.name = `At least ${TRIP_NAME_MIN_LENGTH} characters`;
  else if (form.name.length > TRIP_NAME_MAX_LENGTH)
    next.name = `${TRIP_NAME_MAX_LENGTH} characters max`;

  if (!form.tripType) next.tripType = 'Pick a trip type';

  if (!form.datePicked || !form.startsAt) next.date = 'Required';
  if (!form.timePicked || !form.startsAt) next.time = 'Required';

  // Only check "in the past" once both parts are set, otherwise the half-filled date is misleading.
  // An edit that keeps the saved start is let through, since a trip can still be edited after it starts
  const unchanged = !!originalStartsAt && form.startsAt?.getTime() === originalStartsAt.getTime();
  if (form.startsAt && form.datePicked && form.timePicked && !unchanged) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    if (form.startsAt < startOfToday) next.date = 'Date is in the past';
    else if (form.startsAt <= now) next.time = 'Time has already passed';
  }

  return next;
};

export const normalizeJoinCode = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .slice(0, JOIN_CODE_LENGTH);
