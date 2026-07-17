-- 讨论记录支持一级回复:parent_id 指向被回复的那条发言(null = 顶层发言/提问)
alter table discussion_messages
  add column parent_id uuid references discussion_messages(id) on delete cascade;
create index discussion_messages_parent_idx on discussion_messages (parent_id);
