CREATE INDEX trips_owner_id_idx ON public.trips (owner_id);
ALTER TABLE public.trips alter column id set generated always;
REVOKE UPDATE ON TABLE public.trips FROM authenticated;
GRANT UPDATE (name, starts_at, trip_type, trip_status, image_url) ON TABLE public.trips to authenticated;
