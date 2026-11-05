-- Streams member changes to every open trip screen, so joins, role changes and removals show up
-- without leaving and coming back. Realtime can only filter DELETE events by trip_id when the
-- table's replica identity is full
alter table public.trip_members replica identity full;

alter publication supabase_realtime add table public.trip_members;
