/**
 * @file trip.ts
 * @description The shape components and fixtures agree on for trips.
 */
export type TripType = 'one-way' | 'round-trip';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';
export type StopType = 'start' | 'stop' | 'overnight' | 'end';
export type StopCategory = 'gas' | 'food' | 'coffee' | 'rest' | 'lodging' | 'attraction' | 'other';

export type Trip = {
  id: number;
  numMembers: number;
  image: string | null;
  name: string;
  startsAt: Date;
  departureDate: string;
  departureTime: string;
  tripType: TripType;
};

export type SavedTrip = {
  id: number;
  image: string | null;
  imagePath: string | null;
  name: string;
  tripType: TripType;
};

export type TripMember = {
  id: string;
  name: string;
  avatar: string | null;
  role: TripMemberRole;
};

export type TripImageInput =
  { kind: 'stored'; path: string } | { kind: 'local'; uri: string; mimeType?: string };

export type TripFormValues = {
  name: string;
  tripType: TripType;
  startsAt: Date;
  image: TripImageInput | null;
};

export type TripStop = {
  id: number;
  tripId: number;
  position: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  mapboxId: string | null;
  stopType: StopType;
  stopCategory: StopCategory;
  notes: string | null;
  departsAt: Date | null;
  isTurnaround: boolean; // a round trip's destination
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export type PlaceSuggestion = {
  mapboxId: string;
  name: string;
  address: string | null;
};

export type Place = PlaceSuggestion &
  Coordinates & {
    category: StopCategory;
  };
