-- WhatsApp(及未来 n8n 自动化)导入的课题草稿着陆区
create table topic_drafts (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'whatsapp',
  chat_name text,
  payload jsonb not null,
  status text not null default '待审核'
    check (status in ('待审核','已入库','已弃用')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index topic_drafts_status_idx on topic_drafts (status);
alter table topic_drafts enable row level security;
-- 草稿是管理人工作区:读写都仅管理人
create policy topic_drafts_admin on topic_drafts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger topic_drafts_set_updated_at before update on topic_drafts
  for each row execute function set_updated_at();
