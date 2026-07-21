-- 仅用于 staging 测试库的假数据(切勿在生产库运行)。
-- 建 staging 管理员 admin@kb.local / StagingPass123,以及几条假课题/成员。

-- 管理员登录账号(注意 token 字段置空,否则 GoTrue 登录报 500)
do $$
declare uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'admin@kb.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'admin@kb.local', extensions.crypt('StagingPass123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'admin@kb.local', 'email_verified', true),
      'email', now(), now(), now());
    update public.profiles set role = 'admin' where id = uid;
  end if;
end $$;

-- 期数
insert into cohorts (name) values ('第一期'), ('第二期') on conflict (name) do nothing;

-- 假成员
insert into members (name, english_name, phone, role, cohort_id) values
  ('测试甲', 'Alpha Test', '011-0000001', 'student', (select id from cohorts where name='第一期')),
  ('测试乙', 'Bravo Test', '011-0000002', 'student', (select id from cohorts where name='第一期')),
  ('测试丙', 'Charlie Test', '011-0000003', 'student', (select id from cohorts where name='第二期')),
  ('测试老师', 'Teacher Test', '011-0000009', 'admin', null)
on conflict do nothing;

-- 假课题 1(含讨论记录 + 回复)
insert into topics (title, category, cohort_id, status, tags)
values ('测试课题:如何用 ChatGPT 写营销文案', 'AI工具应用',
  (select id from cohorts where name='第一期'), '已结论', array['ChatGPT','文案']);

insert into discussion_messages (topic_id, speaker_id, speaker_name, body, position, parent_id) values
  ((select id from topics where title like '测试课题:如何用 ChatGPT%'),
   (select id from members where name='测试甲'), '测试甲', '老师,ChatGPT 写出来的文案很空怎么办?', 0, null);
insert into discussion_messages (topic_id, speaker_id, speaker_name, body, position, parent_id) values
  ((select id from topics where title like '测试课题:如何用 ChatGPT%'),
   (select id from members where name='测试老师'), '测试老师', '先给它讲清楚你是谁、卖给谁、要对方做什么。', 1,
   (select id from discussion_messages where body like '老师,ChatGPT%'));

-- 假课题 2
insert into topics (title, category, cohort_id, status, tags)
values ('测试课题:n8n 新手从哪个流程开始', '自动化',
  (select id from cohorts where name='第一期'), '讨论中', array['n8n','入门']);

select 'staging seeded' as done;
