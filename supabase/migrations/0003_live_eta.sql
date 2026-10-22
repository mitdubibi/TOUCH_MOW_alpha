-- Feature 4: live ETA. Volunteers share their location during a session; recipients see
-- "N stops away, about X minutes" on a private link (unit_contacts.track_token).
-- Run once in the Supabase SQL editor after 0002_route_cache.sql.

-- ---------------------------------------------------------------------------
-- Ending a session: stop every volunteer sharing and delete their last position (no history kept).
-- Internal only: called by end_session and set_delivery_status.
-- ---------------------------------------------------------------------------

create function public._finish_session(p_session_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.sessions set status = 'done' where id = p_session_id;
  update public.session_volunteers set sharing_location = false where session_id = p_session_id;
  delete from public.volunteer_locations where session_id = p_session_id;
$$;
revoke execute on function public._finish_session(uuid) from public, anon, authenticated;

-- Organiser ends the session by hand.
create function public.end_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_organiser() then
    raise exception 'Only organisers can end a session' using errcode = '42501';
  end if;
  perform public._finish_session(p_session_id);
end $$;

-- ---------------------------------------------------------------------------
-- Volunteer taps Start delivery. p_route is the planned order (from the app), kept so
-- recipient pages can work out stops away without planning the route again.
-- p_route: {centre: {lat, lng}, totalSeconds, stops: [{postalCode, lat, lng, legSeconds}]}
-- ---------------------------------------------------------------------------

create function public.start_delivery(p_session_id uuid, p_route jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.session_volunteers
    where session_id = p_session_id and volunteer_id = auth.uid()
  ) then
    raise exception 'You are not on this session' using errcode = '42501';
  end if;
  if (select status from public.sessions where id = p_session_id) = 'done' then
    raise exception 'This session has ended' using errcode = '22023';
  end if;

  update public.session_volunteers
  set sharing_location = true,
      route = p_route,
      total_walk_s = (p_route ->> 'totalSeconds')::int,
      optimised_at = now()
  where session_id = p_session_id and volunteer_id = auth.uid();

  update public.sessions set status = 'live' where id = p_session_id and status = 'planned';
end $$;

-- Called every 30 seconds while sharing. Returns false when the volunteer should stop
-- (session ended or sharing turned off), so the phone stops sending.
create function public.share_location(
  p_session_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1
    from public.session_volunteers sv
    join public.sessions s on s.id = sv.session_id
    where sv.session_id = p_session_id
      and sv.volunteer_id = auth.uid()
      and sv.sharing_location
      and s.status = 'live'
  ) then
    return false;
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Not a valid location' using errcode = '22023';
  end if;

  insert into public.volunteer_locations (session_id, volunteer_id, lat, lng, accuracy_m, updated_at)
  values (p_session_id, auth.uid(), p_lat, p_lng, p_accuracy_m, now())
  on conflict (session_id, volunteer_id) do update
    set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  return true;
end $$;

-- Volunteer taps Stop sharing.
create function public.stop_sharing(p_session_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.session_volunteers set sharing_location = false
  where session_id = p_session_id and volunteer_id = auth.uid();
  delete from public.volunteer_locations
  where session_id = p_session_id and volunteer_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Ticking a unit (same as 0001), plus: when the last pending unit of a live session is
-- done, the session ends and location sharing stops.
-- ---------------------------------------------------------------------------

create or replace function public.set_delivery_status(
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

  if p_status <> 'pending'
     and exists (select 1 from public.sessions where id = d.session_id and status = 'live')
     and not exists (select 1 from public.deliveries where session_id = d.session_id and status = 'pending')
  then
    perform public._finish_session(d.session_id);
  end if;

  return d;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: organisers see volunteers move; volunteers' phones see the session end.
-- Full replica identity so deletes (sharing stopped) carry session_id for the filter.
-- ---------------------------------------------------------------------------

alter table public.volunteer_locations replica identity full;
alter publication supabase_realtime add table public.volunteer_locations, public.sessions;
