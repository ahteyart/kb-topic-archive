-- 期数
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- 例:第1期
  starts_on date,
  ends_on date,
  created_at timestamptz default now()
);

-- 成员:学员 + 管理人(老师/助教)
create type member_role as enum ('student', 'admin');
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,                              -- 联络号码,可用于搜索反查
  role member_role not null default 'student',
  cohort_id uuid references cohorts(id) on delete set null,
  created_at timestamptz default now()
);
create index members_phone_idx on members (phone);
create index members_cohort_idx on members (cohort_id);

-- 课题编号(No.001…)
create sequence topic_code_seq start 1;

create type topic_status as enum ('讨论中', '已结论', '待跟进');
create table topics (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('No.' || lpad(nextval('topic_code_seq')::text, 3, '0')),
  title text not null,
  category text,
  cohort_id uuid references cohorts(id) on delete set null,
  status topic_status not null default '讨论中',
  discussion text,                         -- 讨论过程摘要(可选)
  conclusion text,                         -- 老师结论 / 答案(高亮显示)
  tags text[] default '{}',
  asker_id uuid references members(id) on delete set null,  -- 发问学员
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index topics_tags_idx on topics using gin (tags);
create index topics_category_idx on topics (category);
create index topics_cohort_idx on topics (cohort_id);
create index topics_asker_idx on topics (asker_id);

-- 参与者 / 回答者
create table topic_contributors (
  topic_id uuid references topics(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (topic_id, member_id)
);
create index topic_contributors_member_idx on topic_contributors (member_id);

-- 讨论记录:逐条发言(每条绑定一个成员)
create table discussion_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  speaker_id uuid references members(id) on delete set null,
  speaker_name text,                       -- 名录外自由署名的回退
  body text not null,
  position int not null default 0,         -- 排序
  created_at timestamptz default now()
);
create index discussion_messages_topic_idx on discussion_messages (topic_id);
create index discussion_messages_speaker_idx on discussion_messages (speaker_id);

-- updated_at 自动维护
create or replace function set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger topics_set_updated_at before update on topics
  for each row execute function set_updated_at();

-- 积极度视图:每个成员发问数 + 参与/回答的课题数
create view member_engagement
with (security_invoker = on) as
select m.id, m.name, m.phone, m.role, m.cohort_id,
  (select count(*) from topics t where t.asker_id = m.id) as asked,
  (select count(distinct topic_id) from (
      select topic_id from topic_contributors where member_id = m.id
      union
      select topic_id from discussion_messages where speaker_id = m.id
   ) x) as answered
from members m;
