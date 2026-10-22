-- /demo prototype: shared data, so every phone and browser window sees the same thing in real time.
-- Run once in the Supabase SQL editor after 0006_reminders_chat_problems.sql.
--
-- FAKE DATA ONLY (PDPA). Rows are written by "Reset demo data" from src/data/mockData.ts.
-- These are separate demo_ tables so the logged-in app's tables and security (0001 to 0006) are untouched.

create table public.demo_volunteers (
  id text primary key,
  name text not null,
  initials text not null,
  colour text not null
);

create table public.demo_sessions (
  id text primary key,
  date date not null,
  slot text not null check (slot in ('lunch', 'dinner')),
  start_time time not null,
  team text[] not null default '{}'
);

-- One row per household. The elderly link uses the random token, never the unit number.
create table public.demo_units (
  id text primary key,
  block_no text not null,
  unit_no text not null,
  floor int not null,
  postal_code text not null check (postal_code ~ '^\d{6}$'),
  meal_type text not null,
  remarks text not null default '',
  lang text not null default 'en' check (lang in ('en', 'zh')),
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex')
);

-- One unit on one session's list (a household is on several sessions).
create table public.demo_deliveries (
  session_id text not null references public.demo_sessions (id) on delete cascade,
  unit_id text not null references public.demo_units (id) on delete cascade,
  assigned_volunteer text references public.demo_volunteers (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'not_home', 'skipped', 'cancelled')),
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (session_id, unit_id)
);

-- Latest position only (from browser GPS or "Simulate walking"). No history is kept.
create table public.demo_volunteer_locations (
  session_id text not null references public.demo_sessions (id) on delete cascade,
  volunteer_id text not null references public.demo_volunteers (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  simulated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (session_id, volunteer_id)
);

-- thread: a volunteer id (organiser <-> that volunteer), or 'recipients' (messages from elderly).
create table public.demo_messages (
  id uuid primary key default gen_random_uuid(),
  thread text not null,
  sender text not null check (sender in ('organiser', 'volunteer', 'recipient')),
  unit_id text references public.demo_units (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index demo_messages_created_idx on public.demo_messages (created_at);

create table public.demo_problem_reports (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.demo_sessions (id) on delete cascade,
  unit_id text not null references public.demo_units (id) on delete cascade,
  volunteer_id text references public.demo_volunteers (id) on delete set null,
  kind text not null check (kind in ('uneaten', 'no_answer', 'wrong_address')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DEMO ONLY: open access. Anyone with the site (anon key) can read and write these tables.
-- REAL LOGIN AND SECURITY GO HERE: replace these policies with ones like 0001_init.sql
-- (organisers manage everything, volunteers only see sessions they are on, and recipients
-- only reach their own unit through a server function that checks the token).
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'demo_volunteers', 'demo_sessions', 'demo_units', 'demo_deliveries',
    'demo_volunteer_locations', 'demo_messages', 'demo_problem_reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "demo open access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- "Reset demo data" clears everything except households (so elderly links keep working), then the
-- app inserts fresh rows. Server only (service role key): not callable from the browser.
create function public.demo_clear() returns void
language sql security definer set search_path = public as $$
  delete from public.demo_problem_reports where true;
  delete from public.demo_messages where true;
  delete from public.demo_sessions where true; -- also deletes deliveries and locations
$$;
revoke execute on function public.demo_clear() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: ticks, positions, messages and problems reach every open phone.
-- Full replica identity so deletes carry the whole row (e.g. which volunteer stopped sharing).
-- ---------------------------------------------------------------------------

alter table public.demo_volunteer_locations replica identity full;
alter table public.demo_deliveries replica identity full;
alter publication supabase_realtime add table
  public.demo_volunteers, public.demo_sessions, public.demo_units, public.demo_deliveries,
  public.demo_volunteer_locations, public.demo_messages, public.demo_problem_reports;
