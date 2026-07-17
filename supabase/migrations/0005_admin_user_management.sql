-- 用户管理:管理人通过 RPC 新增登录账号 / 改角色 / 重置密码 / 删除。
-- 全部 security definer,函数内先验 is_admin(),学员调用直接报错。

-- 列出所有登录账号(含最近登录时间)
create or replace function public.admin_list_users()
returns table (id uuid, email text, role member_role, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '仅管理人可操作';
  end if;
  return query
    select p.id, p.email, p.role, p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end $$;

-- 新增登录账号(邮箱自动确认,角色可选)
create or replace function public.admin_create_user(p_email text, p_password text, p_role member_role default 'student')
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := gen_random_uuid();
begin
  if not public.is_admin() then
    raise exception '仅管理人可操作';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception '邮箱格式不正确';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception '密码至少 6 位';
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception '这个邮箱已经有账号了';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  -- on_auth_user_created 触发器已自动建 profile,这里设置角色
  update public.profiles set role = p_role where id = uid;
  return uid;
end $$;

-- 改角色 / 重置密码(二者皆可选)
create or replace function public.admin_update_user(p_user_id uuid, p_role member_role default null, p_password text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '仅管理人可操作';
  end if;
  if p_role is not null then
    if p_user_id = auth.uid() and p_role <> 'admin' then
      raise exception '不能把自己降为学员(防止失去管理权限)';
    end if;
    update public.profiles set role = p_role where id = p_user_id;
  end if;
  if p_password is not null then
    if length(p_password) < 6 then
      raise exception '密码至少 6 位';
    end if;
    update auth.users
      set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
      where id = p_user_id;
  end if;
end $$;

-- 删除登录账号(identities / profiles 级联删除;不能删自己)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '仅管理人可操作';
  end if;
  if p_user_id = auth.uid() then
    raise exception '不能删除自己的账号';
  end if;
  delete from auth.users where id = p_user_id;
end $$;

-- 权限:只有已登录用户能调用(函数内再验管理人身份)
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_create_user(text, text, member_role) from public, anon;
revoke all on function public.admin_update_user(uuid, member_role, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_create_user(text, text, member_role) to authenticated;
grant execute on function public.admin_update_user(uuid, member_role, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
