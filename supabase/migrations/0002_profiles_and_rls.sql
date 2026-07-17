-- 用户档案:把 auth.users 和角色(学员/管理人)关联起来
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role member_role not null default 'student',
  member_id uuid references members(id) on delete set null,  -- 可选:关联到名录成员
  created_at timestamptz default now()
);

-- 新用户注册时自动建档(默认学员)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 管理员判定(security definer 避免 RLS 递归)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- 开启 RLS
alter table cohorts enable row level security;
alter table members enable row level security;
alter table topics enable row level security;
alter table topic_contributors enable row level security;
alter table discussion_messages enable row level security;
alter table profiles enable row level security;

-- 读:所有已登录用户可读;写:仅管理人
create policy cohorts_select on cohorts for select to authenticated using (true);
create policy cohorts_write on cohorts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy members_select on members for select to authenticated using (true);
create policy members_write on members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy topics_select on topics for select to authenticated using (true);
create policy topics_write on topics for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy topic_contributors_select on topic_contributors for select to authenticated using (true);
create policy topic_contributors_write on topic_contributors for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy discussion_messages_select on discussion_messages for select to authenticated using (true);
create policy discussion_messages_write on discussion_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles:本人可读自己的,管理人可读全部;仅管理人可改(用于角色管理)
create policy profiles_select_self on profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 注:读策略限定为 authenticated(已登录),以保护名录里的电话号码等 PII。
-- 若要做一个「不需要登录」的公开只读前台,可以把上面的 *_select 策略
-- 从 `to authenticated` 改成 `to anon, authenticated`(会把数据/号码暴露给任何人)。
