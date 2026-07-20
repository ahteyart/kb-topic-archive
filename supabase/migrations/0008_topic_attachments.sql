-- 课题附件(PDF / 图片)
create table topic_attachments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  path text not null,          -- storage 对象路径
  name text not null,          -- 原始文件名
  mime text,
  size int,
  position int not null default 0,
  created_at timestamptz default now()
);
create index topic_attachments_topic_idx on topic_attachments (topic_id);
alter table topic_attachments enable row level security;
create policy topic_attachments_select on topic_attachments
  for select to authenticated using (true);
create policy topic_attachments_write on topic_attachments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 私有存储桶:登录可读(经签名 URL),仅管理人可上传/删除
insert into storage.buckets (id, name, public)
values ('topic-files', 'topic-files', false)
on conflict (id) do nothing;

create policy "topic files read" on storage.objects
  for select to authenticated using (bucket_id = 'topic-files');
create policy "topic files insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'topic-files' and public.is_admin());
create policy "topic files delete" on storage.objects
  for delete to authenticated using (bucket_id = 'topic-files' and public.is_admin());
