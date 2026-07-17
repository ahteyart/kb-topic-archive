-- 固定 search_path(消除 Supabase linter 的 function_search_path_mutable 警告)
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- handle_new_user 只作触发器用,不应通过 PostgREST RPC 暴露
revoke execute on function public.handle_new_user() from anon, authenticated;

-- is_admin 仅 authenticated 需要(RLS 策略调用);anon 用不到
revoke execute on function public.is_admin() from anon;
