-- TOUCH Meals-on-Wheels: initial schema.
-- Run once in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('volunteer', 'organiser');
create type public.session_slot as enum ('lunch', 'dinner');
create type public.session_status as enum ('planned', 'live', 'done');
create type public.delivery_status as enum ('pending', 'delivered', 'not_home', 'skipped', 'cancelled');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'volunteer',
  display_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);

-- Every new login gets a volunteer profile. Organisers are promoted by hand.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------------

create table public.centres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  postal_code text not null check (postal_code ~ '^\d{6}$'),
  lat double precision,
  lng double precision
);

-- One Singapore postal code is one HDB block. Lat/lng are filled by OneMap geocoding.
create table public.blocks (
  postal_code text primary key check (postal_code ~ '^\d{6}$'),
  block_no text not null,
  street text,
  lat double precision,
  lng double precision,
  geocoded_at timestamptz
);

-- One row per household. Contact details live in unit_contacts (organisers only).
create table public.units (
  id uuid primary key default gen_random_uuid(),
  postal_code text not null references public.blocks (postal_code),
  unit_no text not null,
  floor int not null check (floor between 1 and 60),
  unique (postal_code, unit_no)
);

create table public.unit_contacts (
  unit_id uuid primary key references public.units (id) on delete cascade,
  phone text,
  lang text not null default 'en' check (lang in ('en', 'zh')),
  track_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  token_revoked_at timestamptz
);

create function public.create_unit_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.unit_contacts (unit_id) values (new.id);
  return new;
end $$;

create trigger on_unit_created
  after insert on public.units
  for each row execute function public.create_unit_contact();

-- Cached walking times between two postal codes (blocks or centres).
create table public.walk_times (
  from_postal text not null,
  to_postal text not null,
  seconds int not null,
  metres int,
  path text,
  fetched_at timestamptz not null default now(),
  primary key (from_postal, to_postal)
);

-- ---------------------------------------------------------------------------
-- Sessions and deliveries
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  date date not null,
  slot public.session_slot not null,
  start_time time not null,
  status public.session_status not null default 'planned',
  created_at timestamptz not null default now(),
  unique (centre_id, date, slot)
);

create table public.delivery_lists (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  uploaded_by uuid references public.profiles (id),
  file_name text not null,
  row_count int not null,
  summary jsonb not null default '[]',
  uploaded_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  unit_id uuid not null references public.units (id),
  meal_type text not null,
  remarks text,
  assigned_to uuid references public.profiles (id),
  stop_no int,
  status public.delivery_status not null default 'pending',
  done_at timestamptz,
  done_by uuid references public.profiles (id),
  notified_5min_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (session_id, unit_id)
);
create index deliveries_session_idx on public.deliveries (session_id);

create table public.session_volunteers (
  session_id uuid not null references public.sessions (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  blocks text[] not null default '{}',
  route jsonb,
  total_walk_s int,
  optimised_at timestamptz,
  sharing_location boolean not null default false,
  primary key (session_id, volunteer_id)
);

-- Latest position only. No history is kept.
create table public.volunteer_locations (
  session_id uuid not null references public.sessions (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  updated_at timestamptz not null default now(),
  primary key (session_id, volunteer_id)
);

-- ---------------------------------------------------------------------------
-- Messages and reminders
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_type text not null check (thread_type in ('team', 'direct', 'recipient')),
  session_id uuid references public.sessions (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  recipient_id uuid references public.profiles (id),
  unit_id uuid references public.units (id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('evening_before', 'hour_before')),
  channel text not null default 'push',
  send_at timestamptz not null,
  sent_at timestamptz,
  error text,
  unique (session_id, volunteer_id, kind)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function public.is_organiser() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'organiser')
$$;

create function public.is_on_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.session_volunteers
    where session_id = p_session_id and volunteer_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.centres enable row level security;
alter table public.blocks enable row level security;
alter table public.units enable row level security;
alter table public.unit_contacts enable row level security;
alter table public.walk_times enable row level security;
alter table public.sessions enable row level security;
alter table public.delivery_lists enable row level security;
alter table public.deliveries enable row level security;
alter table public.session_volunteers enable row level security;
alter table public.volunteer_locations enable row level security;
alter table public.messages enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;

-- Organisers can do everything on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'centres', 'blocks', 'units', 'unit_contacts', 'walk_times', 'sessions',
    'delivery_lists', 'deliveries', 'session_volunteers', 'volunteer_locations',
    'messages', 'reminders', 'push_subscriptions'
  ] loop
    execute format(
      'create policy "organisers manage %1$s" on public.%1$I for all to authenticated
         using (public.is_organiser()) with check (public.is_organiser())', t);
  end loop;
end $$;

-- Profiles: you see and edit your own name and phone. Role cannot be changed by the user.
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name, phone) on public.profiles to authenticated;

-- Reference data any logged-in user can read.
create policy "read centres" on public.centres for select to authenticated using (true);
create policy "read blocks" on public.blocks for select to authenticated using (true);
create policy "read walk times" on public.walk_times for select to authenticated using (true);

-- Volunteers see sessions they are on, and the units in those sessions.
create policy "volunteers read their sessions" on public.sessions for select to authenticated
  using (public.is_on_session(id));

create policy "volunteers read their team rows" on public.session_volunteers for select to authenticated
  using (volunteer_id = auth.uid());

-- Before the list is split everyone on the team sees every unit.
-- After the split each volunteer only sees units assigned to them.
create policy "volunteers read their deliveries" on public.deliveries for select to authenticated
  using (public.is_on_session(session_id) and (assigned_to is null or assigned_to = auth.uid()));

create policy "volunteers read units they deliver to" on public.units for select to authenticated
  using (exists (
    select 1 from public.deliveries d
    where d.unit_id = units.id
      and public.is_on_session(d.session_id)
      and (d.assigned_to is null or d.assigned_to = auth.uid())
  ));

-- unit_contacts, delivery_lists, messages, reminders, locations, push: organisers only for now.
-- Later features add volunteer policies where needed.

-- ---------------------------------------------------------------------------
-- Ticking a unit. Volunteers cannot update deliveries directly; they call this.
-- p_at is when the tick happened on the phone (it may arrive later if offline).
-- ---------------------------------------------------------------------------

create function public.set_delivery_status(
  p_delivery_id uuid,
  p_status public.delivery_status,
  p_at timestamptz default now()
) returns public.deliveries
language plpgsql security definer set search_path = public as $$
declare
  d public.deliveries;
begin
  select * into d from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_organiser()
    or (public.is_on_session(d.session_id) and (d.assigned_to is null or d.assigned_to = auth.uid()))
  ) then
    raise exception 'You are not on this delivery' using errcode = '42501';
  end if;

  if d.status = 'cancelled' or p_status = 'cancelled' then
    raise exception 'This unit was removed from the list' using errcode = '22023';
  end if;

  update public.deliveries
  set status = p_status,
      done_at = case when p_status = 'pending' then null else least(p_at, now()) end,
      done_by = case when p_status = 'pending' then null else auth.uid() end,
      updated_at = now()
  where id = p_delivery_id
  returning * into d;

  return d;
end $$;

-- ---------------------------------------------------------------------------
-- Importing a delivery list CSV (already validated by the app).
-- Merge rules: ticked units are left alone, new units are added, pending units
-- get the new meal type and remarks, and pending units missing from the new
-- file become 'cancelled'.
-- p_rows: [{date, slot, block, unit, floor, postal_code, meal_type, remarks}]
-- ---------------------------------------------------------------------------

create function public.import_delivery_list(p_centre_id uuid, p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_session_id uuid;
  v_total int;
  v_added int;
  v_updated int;
  v_cancelled int;
  v_summary jsonb := '[]'::jsonb;
begin
  if not public.is_organiser() then
    raise exception 'Only organisers can upload delivery lists' using errcode = '42501';
  end if;

  create temp table _rows on commit drop as
  select (r ->> 'date')::date as d,
         (r ->> 'slot')::public.session_slot as slot,
         r ->> 'postal_code' as postal_code,
         r ->> 'block' as block_no,
         r ->> 'unit' as unit_no,
         (r ->> 'floor')::int as floor,
         r ->> 'meal_type' as meal_type,
         nullif(r ->> 'remarks', '') as remarks
  from jsonb_array_elements(p_rows) r;

  insert into public.blocks (postal_code, block_no)
  select distinct on (postal_code) postal_code, block_no from _rows
  on conflict (postal_code) do nothing;

  insert into public.units (postal_code, unit_no, floor)
  select distinct on (postal_code, unit_no) postal_code, unit_no, floor from _rows
  on conflict (postal_code, unit_no) do nothing;

  for s in select distinct d, slot from _rows order by d, slot loop
    insert into public.sessions (centre_id, date, slot, start_time)
    values (p_centre_id, s.d, s.slot, case when s.slot = 'lunch' then time '08:30' else time '14:30' end)
    on conflict (centre_id, date, slot) do update set start_time = public.sessions.start_time
    returning id into v_session_id;

    with incoming as (
      select distinct on (u.id) u.id as unit_id, r.meal_type, r.remarks
      from _rows r
      join public.units u on u.postal_code = r.postal_code and u.unit_no = r.unit_no
      where r.d = s.d and r.slot = s.slot
    ), up as (
      insert into public.deliveries as del (session_id, unit_id, meal_type, remarks)
      select v_session_id, unit_id, meal_type, remarks from incoming
      on conflict (session_id, unit_id) do update
        set meal_type = excluded.meal_type,
            remarks = excluded.remarks,
            status = 'pending',
            updated_at = now()
        where del.status in ('pending', 'cancelled')
      returning (xmax = 0) as inserted
    )
    select (select count(*) from incoming),
           count(*) filter (where inserted),
           count(*) filter (where not inserted)
    into v_total, v_added, v_updated
    from up;

    update public.deliveries del
    set status = 'cancelled', updated_at = now()
    where del.session_id = v_session_id
      and del.status = 'pending'
      and not exists (
        select 1 from _rows r
        join public.units u on u.postal_code = r.postal_code and u.unit_no = r.unit_no
        where r.d = s.d and r.slot = s.slot and u.id = del.unit_id
      );
    get diagnostics v_cancelled = row_count;

    v_summary := v_summary || jsonb_build_object(
      'id', v_session_id,
      'date', s.d,
      'slot', s.slot,
      'added', v_added,
      'updated', v_updated,
      'kept', v_total - v_added - v_updated,
      'cancelled', v_cancelled
    );
  end loop;

  insert into public.delivery_lists (centre_id, uploaded_by, file_name, row_count, summary)
  values (p_centre_id, auth.uid(), p_file_name, jsonb_array_length(p_rows), v_summary);

  return v_summary;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: ticks show up live on every phone in the session.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.deliveries;
