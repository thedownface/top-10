# Top 10

Ten seats. One standard. Ten athletes build discipline in public: every task needs proof, and every evening each one posts one learning for the community. People in the queue earn a seat with a 7-day trial.

This is an installable mobile web app (PWA). It runs on **Vercel Hobby** and **Supabase Free**, and both cover 1,000 users at no cost.

| Piece | Where | Free-tier fit for 1,000 users |
| --- | --- | --- |
| App (Next.js 16, client-rendered) | Vercel Hobby | Static pages plus one daily cron function |
| Accounts, database, rules | Supabase Postgres + Auth | 50k monthly users, 500 MB database |
| Proof photos and clips | Supabase Storage (private bucket) | 1 GB; photos are compressed to about 300 KB and deleted after 14 days |
| The Ten's private chat | Supabase Realtime | Only the Ten and the Admin subscribe |

## Deploy (about 15 minutes)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). Any region works; Mumbai (`ap-south-1`) is closest to IST users.
2. Open **SQL Editor → New query**, paste all of [supabase/schema.sql](supabase/schema.sql) and click **Run**. It is safe to run again after updates.
3. **Authentication → Sign In / Providers → Email**: choose one of these.
   - Turn **Confirm email** off. This is the simplest option, and new users are signed in straight away.
   - Or keep it on and add custom SMTP under **Authentication → Emails → SMTP** (for example Resend's free tier). Supabase's built-in mailer only sends a few emails per hour, which is not enough for real sign-ups.
4. Optional Google sign-in: enable **Google** under Providers, then set `NEXT_PUBLIC_GOOGLE_AUTH=true` in step 2.
5. Copy these from **Project Settings → API**: the project URL, the anon (publishable) key and the service role (secret) key.

### 2. Vercel

1. Push this folder to a GitHub repository, then **Add New → Project → Import** it on [vercel.com](https://vercel.com). You can also run `npx vercel` from this folder.
2. Add these environment variables (see [.env.example](.env.example)):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable (or anon) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role / secret key (server only) |
   | `CRON_SECRET` | any long random string, e.g. `openssl rand -hex 32` |
   | `NEXT_PUBLIC_GOOGLE_AUTH` | `true` or `false` |

3. Deploy. Then go back to Supabase **Authentication → URL Configuration** and set **Site URL** to your Vercel URL (for example `https://top10.vercel.app`). Add the same URL under **Redirect URLs**.

### 3. Make yourself the Admin

Sign up in the app, then run this once in the Supabase SQL Editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Open the profile icon (top right) and choose **Open the Admin desk**, or go to `/admin`. From there you can:

- **Seats:** create single-use invite codes for open seats, seat the first person in the queue, or remove an athlete.
- **Reasons to review:** view the proof, then accept (the day is excused and the streak paused) or reject (a strike, and the streak resets).
- **Extra task for today:** assign an extra task to the Ten. It locks at 10 pm like the others.
- **Message the room:** post an Admin notice in the Ten's chat.
- **Season:** set the season name and Day I.

To seed the first Ten, create a code for each seat and send it to each athlete privately. They choose **I hold a seat** during onboarding and enter the code.

### 4. Hero photo (optional)

Export `assets/puzzle-figure.jpeg` from the Claude Design project and save it as `public/hero.jpg`. Without it, the welcome screen shows the floating puzzle pieces on their own.

## The rules, and where they are enforced

All rules run inside Postgres functions ([supabase/schema.sql](supabase/schema.sql)), so a modified client cannot skip them:

- Tasks I–V and Admin extras lock at **10:00 pm IST**. The EOD post and missed-task reasons are open until **11:59 pm IST**.
- Each task needs its proof: a photo or clip (15 s, or 30 s for extras), a note, 8 glasses of water, or the name of the athlete you helped.
- A reason needs a category, an explanation and proof. The Admin accepts it (day excused, streak paused) or rejects it (one strike, streak reset). **Three strikes lose the seat.**
- **Closing the day.** A Vercel cron calls `/api/cron/daily` once a day between 00:30 and 01:30 IST. For the day just ended:
  - An athlete who logged every task gets **+1 to their streak**.
  - An athlete who missed a task without sending a reason **loses the seat**.
  - A queue member who logged every task moves one day forward in the trial. A missed day restarts the trial. After 7 days they join the queue, ordered by the date they finished.
  - If a run is missed, the next run catches up on up to 7 days.
- The same cron deletes proof files older than 14 days, so storage stays under 1 GB.
- Row level security limits what each user can read: only the Ten and the Admin can read the chat, users can only see their own task logs, and only the owner and the Admin can open proof files.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev                  # http://localhost:3000
```

`npm run build` runs the type check and the production build.

## Notes

- **Install on a phone:** in Safari, Share → Add to Home Screen; in Chrome, ⋮ → Install app.
- **Supabase pausing:** free projects pause after 7 days without activity. The daily cron counts as activity, so an active deployment stays awake.
- **Not built yet:** push notifications for task reminders. The app shows live countdowns instead. Web Push would need VAPID keys and, on iPhone, the app installed to the home screen.
