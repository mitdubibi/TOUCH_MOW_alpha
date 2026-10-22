-- Feature 5: session reminders, a team chat per session, and problem reports on units.
-- Run once in the Supabase SQL editor after 0005_delivery_photos.sql.

-- ---------------------------------------------------------------------------
-- Collection centre address, shown in reminders and on the volunteer's session page.
-- ---------------------------------------------------------------------------

alter table public.centres add column if not exists address text;

-- ---------------------------------------------------------------------------
-- Reminders: the evening before and 1 hour before a session (see src/lib/reminders.ts).
-- One row per (session, volunteer, kind) once it is sent, so nobody gets the same reminder twice.
-- Rows are written by the server with the service role key. Volunteers read their own and dismiss them.
-- ---------------------------------------------------------------------------

alter table public.reminders
  add column if not exists email_sent_at timestamptz,
  add column if not exists read_at timestamptz;
alter table public.reminders alter column channel set default 'in_app';
create index if not exists reminders_volunteer_idx on public.reminders (volunteer_id, read_at);

create policy "volunteers read own reminders" on public.reminders for select to authenticated
  using (volunteer_id = auth.uid());

-- "Got it" on a reminder card: hides every reminder for that session.
create function public.dismiss_reminders(p_session_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.reminders set read_at = now()
  where session_id = p_session_id and volunteer_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Team chat: messages with thread_type 'team' belong to one session.
-- Volunteers cannot read other people's profiles, so the sender's name is copied onto the message.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists sender_name text,
  add column if not exists sender_is_organiser boolean not null default false;
create index if not exists messages_session_idx on public.messages (session_id, created_at);

create function public.fill_message_sender() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
  end if;
  select * into p from public.profiles where id = new.sender_id;
  new.sender_name := coalesce(nullif(p.display_name, ''), 'Volunteer');
  new.sender_is_organiser := coalesce(p.role = 'organiser', false);
  new.created_at := now();
  new.read_at := null;
  return new;
end $$;

create trigger on_message_insert
  before insert on public.messages
  for each row execute function public.fill_message_sender();

create policy "volunteers read their team chat" on public.messages for select to authenticated
  using (thread_type = 'team' and public.is_on_session(session_id));
create policy "volunteers post in their team chat" on public.messages for insert to authenticated
  with check (thread_type = 'team' and public.is_on_session(session_id) and sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Problem reports on one delivery: meal left uneaten, no answer, wrong address.
-- ---------------------------------------------------------------------------

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  reported_by uuid references public.profiles (id) on delete set null,
  reporter_name text,
  kind text not null check (kind in ('uneaten', 'no_answer', 'wrong_address')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
create index problem_reports_session_idx on public.problem_reports (session_id, created_at);
create index problem_reports_delivery_idx on public.problem_reports (delivery_id);

alter table public.problem_reports enable row level security;
create policy "organisers manage problem_reports" on public.problem_reports for all to authenticated
  using (public.is_organiser()) with check (public.is_organiser());
create policy "volunteers read their session's problems" on public.problem_reports for select to authenticated
  using (public.is_on_session(session_id));

-- Volunteers report through this function (they cannot insert directly).
-- 'No answer' also marks a pending unit as Not home, through set_delivery_status so the session
-- still ends by itself when the last unit is done.
create function public.report_problem(p_delivery_id uuid, p_kind text, p_note text default null)
returns public.problem_reports
language plpgsql security definer set search_path = public as $$
declare
  d public.deliveries;
  r public.problem_reports;
begin
  select * into d from public.deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_organiser()
    or (public.is_on_session(d.session_id) and (d.assigned_to is null or d.assigned_to = auth.uid()))
  ) then
    raise exception 'You are not on this delivery' using errcode = '42501';
  end if;

  if d.status = 'cancelled' then
    raise exception 'This unit was removed from the list' using errcode = '22023';
  end if;

  insert into public.problem_reports (delivery_id, session_id, reported_by, reporter_name, kind, note)
  values (
    p_delivery_id,
    d.session_id,
    auth.uid(),
    (select display_name from public.profiles where id = auth.uid()),
    p_kind,
    nullif(btrim(p_note), '')
  )
  returning * into r;

  if p_kind = 'no_answer' and d.status = 'pending' then
    perform public.set_delivery_status(p_delivery_id, 'not_home');
  end if;

  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: chat messages and problem reports show up without a reload.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages, public.problem_reports;
