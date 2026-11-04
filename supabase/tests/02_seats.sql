-- Trial completion, seating from the queue, three strikes, leaving.
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
update profiles set trial_start = public.ist_today(), trial_days = 6 where name = 'Quinn Queue';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.err($q$select public.log_task('x1', null, '00000000-0000-0000-0000-00000000000d/x.jpg')$q$, 'Extra tasks are for the Ten');
select public.log_task('1', 'drills', '00000000-0000-0000-0000-00000000000d/1.jpg'), public.log_task('2', null, '00000000-0000-0000-0000-00000000000d/2.jpg'),
       public.log_task('3', null, null, null, 8), public.log_task('4', 'note', '00000000-0000-0000-0000-00000000000d/4.jpg'),
       public.log_task('5', 'helped Bo', null, 1);
select 'Q post: ' || public.create_post('Seven days taught me the alarm matters more than the mood.');
reset role;
delete from closed_days;
select 'scored: ' || public.close_day(public.ist_today());
select 'Quinn: trial_days=' || trial_days || ' done=' || (trial_done_at is not null) from profiles where name = 'Quinn Queue';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select public.admin_assign_seat('00000000-0000-0000-0000-00000000000d', 2);
select pg_temp.err($q$select public.admin_assign_seat('00000000-0000-0000-0000-00000000000e', 2)$q$, 'already taken');
reset role;
select 'Quinn now: role=' || role || ' seat=' || seat from profiles where name = 'Quinn Queue';
update profiles set strikes = 2 where name = 'Bo Athlete';
insert into task_logs (user_id, log_date, task_key, status, note, media_path, reason) values ('00000000-0000-0000-0000-00000000000b', public.ist_today() - 1, '2', 'review', 'x', '00000000-0000-0000-0000-00000000000b/r.jpg', 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select public.admin_review((select id from task_logs where status = 'review' limit 1), false);
reset role;
select 'Bo after 3rd strike (expect community): role=' || role || ' seat=' || coalesce(seat::text, '-') from profiles where name = 'Bo Athlete';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select public.leave_path();
reset role;
select 'Quinn after leaving: ' || role || ' seat=' || coalesce(seat::text, '-') from profiles where name = 'Quinn Queue';
-- reset for 03: Bo back in seat I
update profiles set role = 'athlete', seat = 1, seat_since = public.ist_today() - 1, strikes = 0 where name = 'Bo Athlete';
