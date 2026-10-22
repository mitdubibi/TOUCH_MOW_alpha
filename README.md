# TOUCH Meals-on-Wheels (student prototype)

Next.js 16 + Supabase. All data is fake. See CLAUDE.md for the brief.

## Setup

1. **Supabase project** (free, region *Southeast Asia (Singapore)*).
2. In the Supabase **SQL Editor**, run the files in `supabase/migrations/` in order (`0001` to `0008`), then `supabase/seed.sql`.
3. **Authentication > URL Configuration**: Site URL `http://localhost:3000`, and add
   `http://localhost:3000/auth/confirm` to Redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the keys from **Project Settings > API**.
5. Make a free **OneMap** account (https://www.onemap.gov.sg/apidocs/register) and put its email and password in
   `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` in `.env.local`. Used for geocoding and walking routes.
6. `npm install`, then `npm run dev` and open http://localhost:3000.

## Logging in

The installed app opens at `/login`.

- **Volunteers** type their email and then the code from the email. Only accounts you made can log in (no sign-up).
  Make each one with their real email:
  `npm run dev-user -- friend@gmail.com volunteer "Name"` (it also prints a one-time link, handy on a laptop).
  To move an existing account to another email: `npm run change-email -- old@example.com friend@gmail.com`.
- **Organiser**: `organizer@touch` (or `organiser@touch`) logs straight into the `organizer@touch` account, no
  email. Make that account once: `npm run dev-user -- organizer@touch organiser "TOUCH test"`.
- **Elderly**: `old1@touch` and `old2@touch` open the meal page of two seed households (Blk 501 #03-110 and Blk 518
  #05-123). The phone remembers it, so the login page shows an **Open my meal page** button next time.

The login page always shows first. If you are already logged in it also shows **Continue as ...** and **Log out**,
so you can type another login to switch account.

The `@touch` logins have no password, so anyone who knows them gets in. Only ever point them at made-up accounts
and fake households (see `src/app/login/actions.ts`).

For the email code to work, in Supabase:

1. **Authentication > Emails > Magic Link** template: add `{{ .Token }}` so the email shows the code, for example
   `<p>Your Meals on Wheels code is <strong>{{ .Token }}</strong></p>`.
2. **Authentication > Emails > SMTP Settings**: Supabase's built-in email only sends to members of your Supabase
   team, a few per hour. To reach volunteers, turn on custom SMTP, for example Gmail with an app password
   (host `smtp.gmail.com`, port `465`, username = the Gmail address, password = the app password).
3. The code length is set under **Authentication > Providers > Email** (Email OTP Length, 6 at the shortest).

## Scripts

- `npm run dev`: run locally
- `npm test`: unit tests (CSV parsing, units, checklist grouping, route optimiser, live ETA, reminder times)
- `npm run lint`

## Recipient links

Each household has a private link `/t/<token>` with no login (see **Recipient links** at the bottom of an
organiser session page). Location sharing needs https or `localhost`, so on a phone over Wi-Fi
(`http://192.168...`) Start delivery will not work; use the deployed site or a laptop browser.

## Volunteer reminders

Volunteers get a reminder at 7 pm the evening before and 1 hour before each session (time and collection centre
address). It shows at the top of their **My sessions** page and is also emailed.

- **Email**: set `RESEND_API_KEY` in `.env.local` (free account at https://resend.com). Without it, the email is
  printed in the terminal running `npm run dev`. The test sender `onboarding@resend.dev` only delivers to the address
  you signed up to Resend with, so make a dev-user with that address to receive a real email.
- **Locally**: on the organiser **Sessions** page, open **Volunteer reminders** and press **Send due reminders now**.
  The **Pretend the time is** box (not shown in production) lets you test both reminder times at any time of day.
- **Deployed**: the job runs from Supabase every 5 minutes (Vercel's free cron only runs once a day). Set `CRON_SECRET`
  in Vercel, then in the Supabase SQL Editor (Database > Extensions: turn on `pg_cron` and `pg_net`) run this once,
  with your own URL and secret. Do not save it in the repo.

```sql
select cron.schedule('send-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
$$);
```

## Demo prototype (no login)

`/` goes to `/login`. The role picker at `/demo` and everything under it use their own `demo_` tables
(`supabase/migrations/0007_demo_shared_data.sql`), so every phone and browser window shares the same data in real time.
The data is made up and comes from `src/data/mockData.ts`. The first visit fills an empty database, and
**Reset demo data** (bottom of the organiser **Today** screen) puts everything back to the start. Elderly links
(`/demo/elderly/<token>`, listed under **Elderly links** on the same screen) stay the same after a reset.

The demo tables are open to anyone with the site (no login). The migration marks where real login and security would go.

Volunteers tap **Start delivery** to share browser GPS every 30 seconds, or **Simulate walking** to walk the route at
10 times walking speed (it waits at each stop until its units are ticked). The elderly ETA is the walking time to their
unit plus 3 minutes for each unit still before them. GPS more than 3 km from the kitchen is ignored.

## Testing with friends

Send testers the `/test` page: one button per role (Organiser, Volunteer 1, Volunteer 2, three elderly links),
five short tasks, and a **Report a bug** form. Reports are saved in `bug_reports` and listed under
**Bug reports from testers** on the demo organiser **Today** screen. The app can be added to the home screen
(name "TOUCH MOW") and then opens without browser bars, starting at `/login`.

The deployed demo only needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with migrations up to
`0008` run). The logged-in app also needs the other variables in `.env.example`.
