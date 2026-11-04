-- Daily rules and permissions, acting as each kind of user.
\set QUIET on
\pset tuples_only on
\pset format unaligned
create function pg_temp.err(q text, needle text) returns text language plpgsql as $$
begin execute q; return 'FAIL no error: ' || q;
exception when others then
  if sqlerrm ilike '%' || needle || '%' then return 'ok  error: ' || needle; else return 'FAIL wrong error: ' || sqlerrm || ' | ' || q; end if;
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'admin@x', '{"full_name":"Asha Admin"}'),
 ('00000000-0000-0000-0000-00000000000b', 'b@x', '{}'),
 ('00000000-0000-0000-0000-00000000000c', 'c@x', '{}'),
 ('00000000-0000-0000-0000-00000000000d', 'q@x', '{}'),
 ('00000000-0000-0000-0000-00000000000e', 'm@x', '{}');
select 'profiles created by trigger: ' || count(*) from profiles;
update profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
create temp table codes as select public.admin_create_invite(1) c1, public.admin_create_invite(2) c2;
reset role;
grant select on codes to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select pg_temp.err('select public.admin_create_invite(3)', 'Admin only');
select pg_temp.err('select public.close_day(current_date)', 'permission denied');
select pg_temp.err('select public.take_seat(auth.uid(), 3::smallint)', 'permission denied');
select pg_temp.err('select public.close_pending()', 'Admin only');
select 'community sees invites rows: ' || count(*) from invites;
select public.complete_onboarding('Mira Community', 'Running', '', 'community');
select pg_temp.err($q$update profiles set role = 'athlete', seat = 3 where id = auth.uid()$q$, 'permission denied');
select pg_temp.err($q$update profiles set streak = 99 where id = auth.uid()$q$, 'permission denied');
update profiles set goal = 'watching' where id = auth.uid();
select 'M edited own goal: ' || goal from profiles where id = auth.uid();
update profiles set goal = 'hacked' where id = '00000000-0000-0000-0000-00000000000a';
select 'M cannot edit others (expect empty): ' || goal from profiles where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.err($q$select public.log_task('1', 'x', null)$q$, 'Only the Ten');
select pg_temp.err($q$insert into messages (user_id, text) values (auth.uid(), 'hi')$q$, 'row-level security');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.err($q$select public.complete_onboarding('Bo Athlete', 'Gym', 'Ten pull-ups', 'athlete', 'NOPE1234')$q$, 'not valid');
select pg_temp.err($q$select public.complete_onboarding('Bo Athlete', 'Gym', '', 'athlete', 'NOPE1234')$q$, 'goal');
select 'B onboard -> ' || public.complete_onboarding('Bo Athlete', 'Gym', 'Ten pull-ups', 'athlete', (select c1 from codes));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.err($q$select public.redeem_invite((select c1 from codes))$q$, 'not valid');
select 'C onboard -> ' || public.complete_onboarding('Cy Second', 'Running', 'Sub-20 5k', 'athlete', lower((select c2 from codes)));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select 'Q onboard -> ' || public.complete_onboarding('Quinn Queue', 'Sport', 'Earn a seat', 'queue');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.err($q$select public.log_task('1', 'squats', null)$q$, 'proof');
select pg_temp.err($q$select public.log_task('1', 'squats', '00000000-0000-0000-0000-00000000000c/x.jpg')$q$, 'Invalid proof');
select 'log 1: ' || public.log_task('1', 'squats 5x5', '00000000-0000-0000-0000-00000000000b/d/1.jpg');
select pg_temp.err($q$select public.log_task('1', 'again', '00000000-0000-0000-0000-00000000000b/d/1b.jpg')$q$, 'Already locked');
select 'log 2: ' || public.log_task('2', null, '00000000-0000-0000-0000-00000000000b/d/2.jpg');
select pg_temp.err($q$select public.log_task('3', null, null, null, 5)$q$, 'Eight');
select 'log 3: ' || public.log_task('3', null, null, null, 8);
select 'log 4: ' || public.log_task('4', 'ego is heavy', '00000000-0000-0000-0000-00000000000b/d/4.jpg');
select pg_temp.err($q$select public.log_task('5', 'helped myself', null, 1)$q$, 'Pick a member');
select 'log 5: ' || public.log_task('5', 'sent Cy a cue', null, 2);
select pg_temp.err($q$select public.create_post('too short')$q$, 'full sentence');
select 'post id: ' || public.create_post('Motivation left around week two. What stayed was the alarm.');
select pg_temp.err($q$select public.create_post('Second post today should not be allowed at all.')$q$, 'already posted');
select '"locked the whole day" messages (expect 1): ' || count(*) from messages where text like '%locked the whole day%';
insert into messages (user_id, text) values (auth.uid(), 'Good work, everyone.');
select pg_temp.err($q$insert into messages (user_id, sys, text) values (null, true, 'fake admin notice')$q$, 'row-level security');
select pg_temp.err($q$insert into task_logs (user_id, log_date, task_key, status) values (auth.uid(), current_date, '9', 'done')$q$, 'permission denied');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.err($q$select public.submit_reason('1', 0, '', '00000000-0000-0000-0000-00000000000c/r.jpg')$q$, 'Pick a reason');
select 'C reason: ' || public.submit_reason('1', 0, 'Fever, doctor note attached', '00000000-0000-0000-0000-00000000000c/r.jpg', false);
select pg_temp.err($q$select public.log_task('1', 'x', '00000000-0000-0000-0000-00000000000c/x.jpg')$q$, 'with the Admin');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select 'M sees logs (expect 0): ' || count(*) from task_logs;
select 'M sees chat (expect 0): ' || count(*) from messages;
select 'the_ten: ' || string_agg(seat || ':' || name || ':' || done_today, ', ') from public.the_ten();
insert into post_likes (post_id, user_id) select id, auth.uid() from posts limit 1;
insert into post_supports (post_id, user_id) select id, auth.uid() from posts limit 1;
insert into comments (post_id, user_id, text) select id, auth.uid(), 'Saving this.' from posts limit 1;
insert into follows (follower, followee) values (auth.uid(), '00000000-0000-0000-0000-00000000000b');
select pg_temp.err($q$insert into post_likes (post_id, user_id) select id, '00000000-0000-0000-0000-00000000000b' from posts limit 1$q$, 'row-level security');
select 'feed: likes=' || likes || ' supports=' || supports || ' comments=' || comments || ' liked=' || liked || ' following=' || following from public.feed();
select 'feed following-only rows: ' || count(*) from public.feed(null, 20, true);
delete from posts;
select 'posts left after M delete attempt (expect 1): ' || count(*) from posts;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select public.admin_review((select id from task_logs where status = 'review' limit 1), false);
select pg_temp.err($q$select public.admin_review((select id from task_logs where task_key = '1' and status = 'rejected' limit 1), true)$q$, 'Already reviewed');
reset role;
select 'C after reject: strikes=' || strikes || ' streak=' || streak from profiles where id = '00000000-0000-0000-0000-00000000000c';

update profiles set seat_since = public.ist_today() - 1 where role = 'athlete';
select 'close_day today scored: ' || public.close_day(public.ist_today());
select 'close_day again (expect 0): ' || public.close_day(public.ist_today());
select 'after close: ' || string_agg(name || ' role=' || role || ' seat=' || coalesce(seat::text, '-') || ' streak=' || streak, ' | ' order by name) from profiles where id <> '00000000-0000-0000-0000-00000000000a';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b'); set role authenticated;
insert into storage.objects (bucket_id, name) values ('proofs', '00000000-0000-0000-0000-00000000000b/2026-10-29/1.jpg');
select pg_temp.err($q$insert into storage.objects (bucket_id, name) values ('proofs', '00000000-0000-0000-0000-00000000000c/evil.jpg')$q$, 'row-level security');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select 'M sees B proof objects (expect 0): ' || count(*) from storage.objects;
reset role;
set role anon;
select pg_temp.err('select * from profiles', 'permission denied');
reset role;
