/**
 * @file trip.ts
 * @description The shape components and fixtures agree on for trips.
 */
export type TripType = 'one-way' | 'round-trip';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';

export type Trip = {
  id: number;
  numMembers: number;
  image: string | null;
  name: string;
  departureDate: string;
  departureTime: string;
  tripType: TripType;
};

export type Location = {
  id: number;
  name: string;
  address: string;
  type: string;
};

export type TripMember = {
  id: string;
  name: string;
  avatar: string | null;
  role: TripMemberRole;
};
