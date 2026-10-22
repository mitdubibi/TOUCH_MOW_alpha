-- Testing with friends: bug reports from the /test page, and a demo reset that works with the anon key only
-- (so the deployed site does not need the service role key).
-- Run once in the Supabase SQL editor after 0007_demo_shared_data.sql.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'other' check (role in ('organiser', 'volunteer', 'elderly', 'other')),
  what_did text not null check (char_length(what_did) between 1 and 1000),
  what_happened text not null check (char_length(what_happened) between 1 and 1000),
  phone_model text not null default '' check (char_length(phone_model) <= 100),
  page text not null default '' check (char_length(page) <= 200),
  user_agent text not null default '' check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);
create index bug_reports_created_idx on public.bug_reports (created_at desc);

-- ---------------------------------------------------------------------------
-- DEMO ONLY: anyone can send a report and anyone can read them (the demo organiser screen has no login).
-- REAL LOGIN AND SECURITY GO HERE: allow insert for everyone, but select for organisers only
-- (using public.is_organiser(), as in 0001_init.sql).
-- ---------------------------------------------------------------------------

alter table public.bug_reports enable row level security;
create policy "demo send bug reports" on public.bug_reports for insert to anon, authenticated with check (true);
create policy "demo read bug reports" on public.bug_reports for select to anon, authenticated using (true);

-- DEMO ONLY: "Reset demo data" runs with the anon key. The demo_ tables are already open to everyone
-- (0007), so this adds no new access. With real login, revoke this and check for an organiser instead.
grant execute on function public.demo_clear() to anon, authenticated;

alter publication supabase_realtime add table public.bug_reports;
