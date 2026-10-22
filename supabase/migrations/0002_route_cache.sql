-- Feature 3: route optimiser caches.
-- Run once in the Supabase SQL editor after 0001_init.sql.

-- Centres are geocoded with OneMap like blocks. A row with geocoded_at set and lat/lng null
-- means OneMap could not find the postal code (clear geocoded_at to try again).
alter table public.centres add column if not exists geocoded_at timestamptz;

-- Walking is treated as the same both ways, so each pair is stored once with from_postal < to_postal.
-- path is OneMap's encoded polyline from from_postal to to_postal.
comment on table public.walk_times is
  'OneMap walking times. One row per pair, from_postal < to_postal. path is an encoded polyline (precision 5).';
