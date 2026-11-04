\set QUIET on
\pset tuples_only on
\pset format unaligned
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create function pg_temp.err(q text, needle text) returns text language plpgsql as $$
begin execute q; return 'FAIL no error: ' || q;
exception when others then
  if sqlerrm ilike '%' || needle || '%' then return 'ok  error: ' || needle; else return 'FAIL wrong error: ' || sqlerrm; end if;
end $$;
-- Bo holds seat I. Coach (service role) gives Bo a personal task.
insert into extra_tasks (title, proof, user_id, source) values ('Do 5 slow negative pull-ups', 'Clip', '00000000-0000-0000-0000-00000000000b', 'coach');
select 'Bo day state with personal task pending: ' || public.day_state('00000000-0000-0000-0000-00000000000b', public.ist_today(), true);
-- Another athlete must not see or log Bo's personal task
update profiles set role = 'athlete', seat = 3, seat_since = public.ist_today() where id = '00000000-0000-0000-0000-00000000000e';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select 'M sees personal tasks of others: ' || count(*) from extra_tasks where user_id is not null;
select pg_temp.err(format($q$select public.log_task('x%s', null, '00000000-0000-0000-0000-00000000000e/x.jpg')$q$, (select max(id) from extra_tasks)), 'Unknown task');
reset role;
select 'M day state unaffected by Bo task: ' || public.day_state('00000000-0000-0000-0000-00000000000e', public.ist_today(), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select 'Bo sees own personal task: ' || count(*) from extra_tasks where user_id = auth.uid();
select 'Bo logs it: ' || public.log_task('x' || (select max(id) from extra_tasks), null, '00000000-0000-0000-0000-00000000000b/x.jpg');
reset role;
select 'Bo day state now: ' || public.day_state('00000000-0000-0000-0000-00000000000b', public.ist_today(), true);
-- Coach as service role: rule on a reason and fill seats
update profiles set role = 'queue', trial_done_at = now() - interval '1 day', trial_days = 7 where id = '00000000-0000-0000-0000-00000000000d';
select set_config('request.jwt.claims', '{"role":"service_role"}', false); set role service_role;
select 'fill_seats: ' || public.fill_seats();
reset role;
select 'seated: ' || string_agg(name || '=' || seat, ', ' order by seat) from profiles where seat is not null;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select pg_temp.err($q$select public.fill_seats()$q$, 'Admin only');
reset role;
insert into task_logs (user_id, log_date, task_key, status, note, media_path, reason) values ('00000000-0000-0000-0000-00000000000e', public.ist_today(), '2', 'review', 'fever', '00000000-0000-0000-0000-00000000000e/r.jpg', 0);
select set_config('request.jwt.claims', '{"role":"service_role"}', false); set role service_role;
select public.admin_review((select id from task_logs where status = 'review' and user_id = '00000000-0000-0000-0000-00000000000e'), true);
reset role;
select 'coach review stored as: ' || status || ' by ' || reviewed_by from task_logs where user_id = '00000000-0000-0000-0000-00000000000e' and task_key = '2';
