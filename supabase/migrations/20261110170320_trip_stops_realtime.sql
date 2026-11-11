-- Stop changes already stream to open trip screens (trip_stops joined the publication when it was
-- created), but Realtime only filters DELETE events by trip_id when the replica identity is full.
-- Without it, a stop removed on one phone stays on every other phone until they reload.
-- RLS still applies: Realtime strips a deleted row down to its id, so nothing else about it leaks
alter table public.trip_stops replica identity full;
