/**
 * @file trip.ts
 * @description The shape components and fixtures agree on for trips.
 */
export type TripDuration = 'multi-day' | 'single-day';

export type TripType = 'one-way' | 'round-trip';

export type Trip = {
  id: number;
  numMembers: number;
  image: string | null;
  name: string;
  departureDate: string;
  departureTime: string;
  duration: TripDuration;
  tripType: TripType;
};

export type Location = {
  id: number;
  name: string;
  address: string;
  type: string;
};
