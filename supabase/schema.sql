-- ════════════════════════════════════════════════════════════════════════
-- Top 10 · database schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: functions and policies are replaced, tables are kept.
--
-- All daily rules live here, not in the browser:
--   tasks I–V and extras lock at 10:00 pm IST; EOD post and reasons at 11:59 pm
--   every task needs proof; every miss needs a reason with proof
--   a day closes at midnight IST (see close_day): all done → streak +1,
--   anything missing without a reason → seat is lost; rejected reason → 1 strike,
--   three strikes → seat is lost
-- ════════════════════════════════════════════════════════════════════════

-- ── time ──────────────────────────────────────────────────────────────
create or replace function public.ist_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.ist_time() returns time
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::time $$;

-- ── tables ────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  season_name text not null default 'Season I' check (char_length(season_name) <= 40),
  season_start date not null default public.ist_today()
);
insert into public.settings default values on conflict do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  training text not null default 'Gym' check (char_length(training) <= 30),
  goal text not null default '' check (char_length(goal) <= 140),
  role text not null default 'community' check (role in ('community', 'queue', 'athlete')),
  seat smallint unique check (seat between 1 and 10),
  seat_since date,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  streak int not null default 0,
  strikes int not null default 0 check (strikes >= 0),
  trial_start date,
  trial_days int not null default 0,
  trial_done_at timestamptz,
  created_at timestamptz not null default now(),
  constraint seat_matches_role check ((role = 'athlete') = (seat is not null))
);
create index if not exists profiles_role_idx on public.profiles (role);

create table if not exists public.invites (
  code text primary key,
  seat smallint not null check (seat between 1 and 10),
  created_at timestamptz not null default now(),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz
);

create table if not exists public.extra_tasks (
  id bigint generated always as identity primary key,
  for_date date not null default public.ist_today(),
  title text not null check (char_length(title) between 3 and 80),
  proof text not null default 'Photo or clip up to 30 s' check (char_length(proof) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists extra_tasks_date_idx on public.extra_tasks (for_date);

create table if not exists public.task_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  task_key text not null,                -- '1'..'6' core, 'x<id>' extra
  status text not null check (status in ('done', 'review', 'excused', 'rejected')),
  note text check (char_length(note) <= 500),
  helped_seat smallint,
  water smallint,
  media_path text,
  reason smallint check (reason between 0 and 4),
  admin_only boolean not null default true,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, log_date, task_key)
);
create index if not exists task_logs_status_idx on public.task_logs (status) where status = 'review';
create index if not exists task_logs_date_idx on public.task_logs (log_date);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  sys boolean not null default false,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_date date not null default public.ist_today(),
  text text not null check (char_length(text) between 20 and 280),
  created_at timestamptz not null default now(),
  unique (user_id, post_date)
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.post_supports (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.follows (
  follower uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee uuid not null references public.profiles(id) on delete cascade,
  primary key (follower, followee),
  check (follower <> followee)
);

create table if not exists public.closed_days (
  day date primary key,
  closed_at timestamptz not null default now()
);

-- ── role helpers ──────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_athlete() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'athlete' from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_service() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'role', '') = 'service_role' $$;

-- ── new user → profile ────────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── row level security ────────────────────────────────────────────────
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.extra_tasks enable row level security;
alter table public.task_logs enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_supports enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.closed_days enable row level security;

-- Nobody signed out can read anything.
revoke all on all tables in schema public from anon;

drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select to authenticated using (true);
drop policy if exists "settings admin" on public.settings;
create policy "settings admin" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: everyone signed in can read; you may only edit name / training / goal.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, training, goal) on public.profiles to authenticated;

drop policy if exists "invites admin" on public.invites;
create policy "invites admin" on public.invites for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.invites from authenticated;

drop policy if exists "extras read" on public.extra_tasks;
create policy "extras read" on public.extra_tasks for select to authenticated using (true);
drop policy if exists "extras admin insert" on public.extra_tasks;
create policy "extras admin insert" on public.extra_tasks for insert to authenticated with check (public.is_admin());
drop policy if exists "extras admin delete" on public.extra_tasks;
create policy "extras admin delete" on public.extra_tasks for delete to authenticated using (public.is_admin());

-- Task logs are written only through the functions below.
drop policy if exists "logs read own or admin" on public.task_logs;
create policy "logs read own or admin" on public.task_logs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.task_logs from authenticated;

-- The private room: the Ten and the Admin only.
drop policy if exists "chat read" on public.messages;
create policy "chat read" on public.messages for select to authenticated
  using (public.is_athlete() or public.is_admin());
drop policy if exists "chat write" on public.messages;
create policy "chat write" on public.messages for insert to authenticated with check (
  (sys = false and user_id = auth.uid() and (public.is_athlete() or public.is_admin()))
  or (sys = true and public.is_admin())
);
drop policy if exists "chat admin delete" on public.messages;
create policy "chat admin delete" on public.messages for delete to authenticated using (public.is_admin());
revoke update on public.messages from authenticated;

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (true);
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update on public.posts from authenticated;

drop policy if exists "likes read" on public.post_likes;
create policy "likes read" on public.post_likes for select to authenticated using (true);
drop policy if exists "likes own" on public.post_likes;
create policy "likes own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes own delete" on public.post_likes;
create policy "likes own delete" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "supports read" on public.post_supports;
create policy "supports read" on public.post_supports for select to authenticated using (true);
drop policy if exists "supports own" on public.post_supports;
create policy "supports own" on public.post_supports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "supports own delete" on public.post_supports;
create policy "supports own delete" on public.post_supports for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select to authenticated using (true);
drop policy if exists "comments own" on public.comments;
create policy "comments own" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());
revoke update on public.comments from authenticated;

drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select to authenticated using (true);
drop policy if exists "follows own" on public.follows;
create policy "follows own" on public.follows for insert to authenticated with check (follower = auth.uid());
drop policy if exists "follows own delete" on public.follows;
create policy "follows own delete" on public.follows for delete to authenticated using (follower = auth.uid());

-- ── day state ─────────────────────────────────────────────────────────
-- 'done' | 'missing' | 'rejected' | 'review' | 'excused'
create or replace function public.day_state(p_uid uuid, p_date date, p_with_extras boolean)
returns text language sql stable security definer set search_path = public as $$
  with req as (
    select k from unnest(array['1', '2', '3', '4', '5', '6']) as k
    union all
    select 'x' || e.id from extra_tasks e where e.for_date = p_date and p_with_extras
  ), st as (
    select r.k, l.status
    from req r
    left join task_logs l on l.user_id = p_uid and l.log_date = p_date and l.task_key = r.k
  )
  select case
    when bool_and(coalesce(status = 'done', false)) then 'done'
    when bool_or(status is null) then 'missing'
    when bool_or(status = 'rejected') then 'rejected'
    when bool_or(status = 'review') then 'review'
    else 'excused'
  end from st
$$;

-- The ten seats with today's completion, for the Figure and the chat strip.
create or replace function public.the_ten()
returns table (seat smallint, user_id uuid, name text, training text, streak int, strikes int, done_today boolean)
language sql stable security definer set search_path = public as $$
  select p.seat, p.id, p.name, p.training, p.streak, p.strikes,
         day_state(p.id, ist_today(), true) = 'done'
  from profiles p where p.role = 'athlete' order by p.seat
$$;

-- ── seats ─────────────────────────────────────────────────────────────
create or replace function public.remove_athlete(p_uid uuid, p_why text)
returns void language plpgsql security definer set search_path = public as $$
declare v_seat smallint; v_name text;
begin
  select seat, name into v_seat, v_name from profiles where id = p_uid and role = 'athlete' for update;
  if v_seat is null then return; end if;
  update profiles set role = 'community', seat = null, seat_since = null, streak = 0, strikes = 0 where id = p_uid;
  insert into messages (sys, text)
  values (true, format('Seat %s is open · %s %s. Next in the queue will be invited.', to_char(v_seat, 'FMRN'), split_part(v_name, ' ', 1), p_why));
end $$;

create or replace function public.take_seat(p_uid uuid, p_seat smallint)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if exists (select 1 from profiles where seat = p_seat) then raise exception 'Seat % is already taken.', p_seat; end if;
  update profiles set role = 'athlete', seat = p_seat, seat_since = ist_today(), streak = 0, strikes = 0,
         trial_start = null, trial_days = 0, trial_done_at = null
  where id = p_uid returning name into v_name;
  insert into messages (sys, text) values (true, format('%s takes Seat %s. Welcome to the room.', v_name, to_char(p_seat, 'FMRN')));
end $$;

create or replace function public.redeem_invite(p_code text)
returns smallint language plpgsql security definer set search_path = public as $$
declare v_inv invites; v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null then raise exception 'Sign in first.'; end if;
  if v_role = 'athlete' then raise exception 'You already hold a seat.'; end if;
  select * into v_inv from invites where code = upper(btrim(coalesce(p_code, ''))) and used_by is null for update;
  if v_inv.code is null then raise exception 'That invite code is not valid.'; end if;
  perform take_seat(auth.uid(), v_inv.seat);
  update invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.seat;
end $$;

create or replace function public.complete_onboarding(p_name text, p_training text, p_goal text, p_path text, p_code text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_me profiles;
begin
  select * into v_me from profiles where id = auth.uid() for update;
  if v_me.id is null then raise exception 'Sign in first.'; end if;
  p_name := btrim(coalesce(p_name, ''));
  p_goal := btrim(coalesce(p_goal, ''));
  if char_length(p_name) < 2 then raise exception 'Add your name to continue.'; end if;
  if p_training not in ('Gym', 'Calisthenics', 'Running', 'Sport') then raise exception 'Pick a training type.'; end if;
  if p_path not in ('community', 'queue', 'athlete') then raise exception 'Pick a path.'; end if;
  if p_path <> 'community' and char_length(p_goal) < 3 then raise exception 'Add your goal for this season.'; end if;

  update profiles set name = left(p_name, 60), training = p_training, goal = left(p_goal, 140) where id = v_me.id;

  if p_path = 'athlete' and v_me.role <> 'athlete' then
    perform redeem_invite(p_code);
  elsif p_path = 'queue' and v_me.role = 'community' then
    update profiles set role = 'queue', trial_start = ist_today(), trial_days = 0, trial_done_at = null where id = v_me.id;
  end if;

  update profiles set onboarded = true where id = v_me.id;
  return (select role from profiles where id = v_me.id);
end $$;

create or replace function public.start_trial()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set role = 'queue', trial_start = ist_today(), trial_days = 0, trial_done_at = null
  where id = auth.uid() and role = 'community';
  if not found then raise exception 'Only community members can start a trial.'; end if;
end $$;

create or replace function public.leave_path()
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role = 'athlete' then
    perform remove_athlete(auth.uid(), 'gave up the seat');
  elsif v_role = 'queue' then
    update profiles set role = 'community', trial_start = null, trial_days = 0, trial_done_at = null where id = auth.uid();
  end if;
end $$;

-- ── logging ───────────────────────────────────────────────────────────
create or replace function public.after_log(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me profiles;
begin
  select * into v_me from profiles where id = p_uid;
  if v_me.role = 'athlete' and day_state(p_uid, ist_today(), true) = 'done' then
    insert into messages (sys, text)
    values (true, format('Seat %s · %s locked the whole day.', to_char(v_me.seat, 'FMRN'), split_part(v_me.name, ' ', 1)));
  end if;
end $$;

create or replace function public.log_task(p_task text, p_note text default null, p_media text default null, p_helped int default null, p_water int default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_me profiles; v_d date := ist_today(); v_existing text; v_extra extra_tasks;
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then raise exception 'Sign in first.'; end if;
  if v_me.role not in ('athlete', 'queue') then raise exception 'Only the Ten and trial members log tasks.'; end if;
  if ist_time() >= time '22:00' then raise exception 'Tasks locked at 10:00 pm. You can still send a reason until 11:59 pm.'; end if;

  select status into v_existing from task_logs where user_id = v_me.id and log_date = v_d and task_key = p_task;
  if v_existing = 'done' then raise exception 'Already locked.'; end if;
  if v_existing = 'review' then raise exception 'Your reason is with the Admin.'; end if;
  if v_existing is not null then raise exception 'This task is closed for today.'; end if;

  p_note := nullif(btrim(coalesce(p_note, '')), '');
  if p_media is not null and split_part(p_media, '/', 1) <> v_me.id::text then raise exception 'Invalid proof file.'; end if;

  if p_task in ('1', '4') then
    if p_media is null or p_note is null then raise exception 'Add the proof first.'; end if;
  elsif p_task = '2' then
    if p_media is null then raise exception 'Add the proof first.'; end if;
  elsif p_task = '3' then
    if coalesce(p_water, 0) < 8 then raise exception 'Eight glasses first.'; end if;
  elsif p_task = '5' then
    if p_note is null or p_helped is null then raise exception 'Name who you helped and how.'; end if;
    if not exists (select 1 from profiles where seat = p_helped and role = 'athlete' and id <> v_me.id) then
      raise exception 'Pick a member of the Ten.';
    end if;
  elsif p_task like 'x%' then
    if v_me.role <> 'athlete' then raise exception 'Extra tasks are for the Ten.'; end if;
    select * into v_extra from extra_tasks where id::text = substr(p_task, 2) and for_date = v_d;
    if v_extra.id is null then raise exception 'Unknown task.'; end if;
    if p_media is null then raise exception 'Add the proof first.'; end if;
  else
    raise exception 'Unknown task.';
  end if;

  insert into task_logs (user_id, log_date, task_key, status, note, helped_seat, water, media_path)
  values (v_me.id, v_d, p_task, 'done', p_note, p_helped, p_water, p_media);
  perform after_log(v_me.id);
  return 'done';
end $$;

create or replace function public.submit_reason(p_task text, p_reason int, p_note text, p_media text, p_admin_only boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare v_me profiles; v_d date := ist_today();
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then raise exception 'Sign in first.'; end if;
  if v_me.role not in ('athlete', 'queue') then raise exception 'Only the Ten and trial members log tasks.'; end if;
  if p_task not in ('1', '2', '3', '4', '5', '6')
     and not (p_task like 'x%' and exists (select 1 from extra_tasks where id::text = substr(p_task, 2) and for_date = v_d)) then
    raise exception 'Unknown task.';
  end if;
  if exists (select 1 from task_logs where user_id = v_me.id and log_date = v_d and task_key = p_task) then
    raise exception 'This task is already logged for today.';
  end if;
  p_note := nullif(btrim(coalesce(p_note, '')), '');
  if p_reason is null or p_reason not between 0 and 4 or p_note is null or p_media is null then
    raise exception 'Pick a reason, explain, and add proof.';
  end if;
  if split_part(p_media, '/', 1) <> v_me.id::text then raise exception 'Invalid proof file.'; end if;

  insert into task_logs (user_id, log_date, task_key, status, note, media_path, reason, admin_only)
  values (v_me.id, v_d, p_task, 'review', left(p_note, 500), p_media, p_reason, coalesce(p_admin_only, true));

  if v_me.role = 'athlete' and not coalesce(p_admin_only, true) then
    insert into messages (sys, text) values (true, format('Seat %s · %s sent a reason to the Admin: %s',
      to_char(v_me.seat, 'FMRN'), split_part(v_me.name, ' ', 1), left(p_note, 200)));
  end if;
  return 'review';
end $$;

create or replace function public.create_post(p_text text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_me profiles; v_id bigint; v_d date := ist_today();
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then raise exception 'Sign in first.'; end if;
  if v_me.role not in ('athlete', 'queue') then raise exception 'Only the Ten and trial members post learnings.'; end if;
  p_text := btrim(coalesce(p_text, ''));
  if char_length(p_text) < 20 then raise exception 'Write at least one full sentence.'; end if;
  if char_length(p_text) > 280 then raise exception 'Keep it to 280 characters.'; end if;
  if exists (select 1 from posts where user_id = v_me.id and post_date = v_d) then raise exception 'You already posted today.'; end if;

  insert into posts (user_id, post_date, text) values (v_me.id, v_d, p_text) returning id into v_id;
  insert into task_logs (user_id, log_date, task_key, status)
  values (v_me.id, v_d, '6', 'done')
  on conflict (user_id, log_date, task_key) do update set status = 'done' where task_logs.status = 'review';
  perform after_log(v_me.id);
  return v_id;
end $$;

-- ── agora feed ────────────────────────────────────────────────────────
drop function if exists public.feed(timestamptz, int);
create or replace function public.feed(p_before timestamptz default null, p_limit int default 20, p_following boolean default false)
returns table (
  id bigint, user_id uuid, post_date date, text text, created_at timestamptz,
  author_name text, author_role text, author_seat smallint, author_training text,
  author_streak int, author_trial_days int,
  likes bigint, supports bigint, comments bigint,
  liked boolean, supported boolean, following boolean, day_no int
)
language sql stable security invoker set search_path = public as $$
  select p.id, p.user_id, p.post_date, p.text, p.created_at,
         a.name, a.role, a.seat, a.training, a.streak, a.trial_days,
         (select count(*) from post_likes l where l.post_id = p.id),
         (select count(*) from post_supports s where s.post_id = p.id),
         (select count(*) from comments c where c.post_id = p.id),
         exists (select 1 from post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         exists (select 1 from post_supports s where s.post_id = p.id and s.user_id = auth.uid()),
         exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.user_id),
         (p.post_date - (select season_start from settings where settings.id = 1)) + 1
  from posts p join profiles a on a.id = p.user_id
  where (p_before is null or p.created_at < p_before)
    and (not coalesce(p_following, false) or exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.user_id))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ── admin ─────────────────────────────────────────────────────────────
create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
end $$;

create or replace function public.admin_create_invite(p_seat int)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform require_admin();
  if p_seat not between 1 and 10 then raise exception 'Seats are I to X.'; end if;
  if exists (select 1 from profiles where seat = p_seat) then raise exception 'That seat is taken.'; end if;
  update invites set used_at = now() where seat = p_seat and used_by is null and used_at is null; -- retire old codes
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into invites (code, seat) values (v_code, p_seat);
  return v_code;
end $$;

create or replace function public.admin_assign_seat(p_uid uuid, p_seat int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if exists (select 1 from profiles where id = p_uid and role = 'athlete') then raise exception 'Already holds a seat.'; end if;
  perform take_seat(p_uid, p_seat::smallint);
  update profiles set onboarded = true where id = p_uid;
end $$;

create or replace function public.admin_remove(p_uid uuid, p_why text default 'was removed by the Admin')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  perform remove_athlete(p_uid, coalesce(nullif(btrim(p_why), ''), 'was removed by the Admin'));
end $$;

create or replace function public.admin_review(p_log bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_log task_logs; v_me profiles;
begin
  perform require_admin();
  select * into v_log from task_logs where id = p_log and status = 'review' for update;
  if v_log.id is null then raise exception 'Already reviewed.'; end if;
  update task_logs set status = case when p_accept then 'excused' else 'rejected' end, reviewed_at = now() where id = p_log;
  if p_accept then return; end if;

  select * into v_me from profiles where id = v_log.user_id for update;
  if v_me.role = 'athlete' then
    update profiles set strikes = strikes + 1, streak = 0 where id = v_me.id;
    if v_me.strikes + 1 >= 3 then
      perform remove_athlete(v_me.id, 'reached three strikes');
    else
      insert into messages (sys, text) values (true, format('Seat %s · strike %s. Reason rejected.', to_char(v_me.seat, 'FMRN'), v_me.strikes + 1));
    end if;
  elsif v_me.role = 'queue' and v_me.trial_done_at is null then
    update profiles set trial_days = 0, trial_start = ist_today() + 1 where id = v_me.id;
  end if;
end $$;

-- ── closing the day (runs from the daily cron, or the Admin page) ─────
create or replace function public.close_day(p_date date)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_state text; n int := 0;
begin
  insert into closed_days (day) values (p_date) on conflict do nothing;
  if not found then return 0; end if;

  for r in select id from profiles where role = 'athlete' and coalesce(seat_since, p_date - 1) < p_date loop
    v_state := day_state(r.id, p_date, true);
    if v_state = 'done' then
      update profiles set streak = streak + 1 where id = r.id;
    elsif v_state = 'missing' then
      perform remove_athlete(r.id, format('missed %s without a reason', to_char(p_date, 'FMDD Mon')));
    end if;
    n := n + 1;
  end loop;

  for r in select id, trial_days from profiles where role = 'queue' and trial_done_at is null and trial_start <= p_date loop
    v_state := day_state(r.id, p_date, false);
    if v_state = 'done' then
      update profiles set trial_days = r.trial_days + 1,
             trial_done_at = case when r.trial_days + 1 >= 7 then now() end
      where id = r.id;
    elsif v_state = 'missing' then
      update profiles set trial_days = 0, trial_start = p_date + 1 where id = r.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Closes every unclosed day up to yesterday (at most the last 7), so a skipped cron run catches up.
create or replace function public.close_pending()
returns int language plpgsql security definer set search_path = public as $$
declare v_from date; v_d date; n int := 0;
begin
  if not (is_service() or is_admin()) then raise exception 'Admin only.'; end if;
  select greatest(coalesce(max(day) + 1, (select season_start from settings where id = 1)), ist_today() - 7)
    into v_from from closed_days;
  v_d := v_from;
  while v_d < ist_today() loop
    n := n + close_day(v_d);
    v_d := v_d + 1;
  end loop;
  return n;
end $$;

-- ── function permissions ──────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ist_today(), public.ist_time(), public.is_admin(), public.is_athlete(), public.is_service(),
  public.the_ten(), public.redeem_invite(text), public.complete_onboarding(text, text, text, text, text),
  public.start_trial(), public.leave_path(),
  public.log_task(text, text, text, int, int), public.submit_reason(text, int, text, text, boolean),
  public.create_post(text), public.feed(timestamptz, int, boolean),
  public.admin_create_invite(int), public.admin_assign_seat(uuid, int), public.admin_remove(uuid, text),
  public.admin_review(bigint, boolean), public.close_pending()
to authenticated;
grant execute on function public.close_pending(), public.ist_today() to service_role;
-- Internal helpers (day_state, take_seat, remove_athlete, after_log, close_day, require_admin)
-- stay callable only from inside the functions above.

-- ── realtime chat ─────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ── proof storage (private bucket, 12 MB per file) ────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 12582912,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "proofs upload own folder" on storage.objects;
create policy "proofs upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "proofs read own or admin" on storage.objects;
create policy "proofs read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
