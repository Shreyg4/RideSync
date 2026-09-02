update public.trips set trip_type = 'round-trip' where trip_type = 'round trip';

alter table public.trips drop constraint trip_type_valid;

alter table public.trips
  add constraint trip_type_valid check (trip_type = any (array['one-way'::text, 'round-trip'::text]));
