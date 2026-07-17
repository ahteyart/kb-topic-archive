-- 可选:示例数据(与原型 knowledge-base.jsx 的 SEED 对齐)。
-- 在 Supabase SQL Editor 里运行,或用 `supabase db reset` 时自动加载。

insert into cohorts (name) values ('第1期'), ('第2期') on conflict (name) do nothing;

insert into members (name, phone, role, cohort_id) values
  ('陈美玲', '012-3456789', 'student', (select id from cohorts where name='第1期')),
  ('林伟强', '016-2233445', 'student', (select id from cohorts where name='第1期')),
  ('黄晓芳', '017-8899001', 'student', (select id from cohorts where name='第2期')),
  ('郑老师', '019-7778888', 'admin', null)
on conflict do nothing;

insert into topics (title, category, cohort_id, status, discussion, conclusion, tags, asker_id)
values (
  '如何用 ChatGPT 帮 SME 写出第一篇能用的营销文案', 'AI工具应用',
  (select id from cohorts where name='第1期'), '已结论',
  '学员普遍反映:让 AI 写文案,出来的东西很空、很像广告口号,不像自己的生意。追问后发现,大家给的指令都是「帮我写一篇卖椰浆饭的文案」这种一句话。',
  '给 AI 下指令前,先讲清楚三件事:你是谁(什么店、什么特色)、卖给谁(什么样的客人)、想要对方做什么(到店 / 加 WhatsApp / 下单)。再给它一个具体角色(「你是一位在地美食博主」)和一两个你喜欢的例子,输出质量会立刻不一样。',
  array['文案','ChatGPT','营销'],
  (select id from members where name='陈美玲')
);

insert into topics (title, category, cohort_id, status, discussion, conclusion, tags, asker_id)
values (
  'n8n 自动化,新手从哪一个流程开始最容易上手', '自动化',
  (select id from cohorts where name='第1期'), '已结论',
  '多数学员一打开 n8n 就卡在触发器和凭证(credentials)配置,试着一次做完整个流程,结果哪个节点报错都不知道。',
  '从「定时抓一个网页 → 整理成一句话 → 发到 Telegram」这种单线三节点流程练起。先把一条最短的路跑通、看到消息真的发出来,再往上加判断和分支。不要一开始就搭复杂流程。',
  array['n8n','自动化','入门'],
  (select id from members where name='林伟强')
);

insert into topic_contributors (topic_id, member_id)
select (select id from topics where code='No.001'), m.id from members m where m.name in ('林伟强','黄晓芳','郑老师')
on conflict do nothing;
insert into topic_contributors (topic_id, member_id)
select (select id from topics where code='No.002'), m.id from members m where m.name in ('陈美玲','郑老师')
on conflict do nothing;

insert into discussion_messages (topic_id, speaker_id, speaker_name, body, position) values
  ((select id from topics where code='No.001'), (select id from members where name='陈美玲'), '陈美玲', '我让 ChatGPT 帮我写椰浆饭的文案,可是写出来很像大品牌广告,不像我的小店。', 0),
  ((select id from topics where code='No.001'), (select id from members where name='郑老师'), '郑老师', '你给它的指令太短了,它不知道你的店有什么特色、客人是谁。', 1),
  ((select id from topics where code='No.001'), (select id from members where name='林伟强'), '林伟强', '所以要先给它背景对吗?我上次加了「我是夜市摊」效果就好一点。', 2),
  ((select id from topics where code='No.001'), (select id from members where name='郑老师'), '郑老师', '对,再加一个角色和一两个例子会更好。', 3);

insert into discussion_messages (topic_id, speaker_id, speaker_name, body, position) values
  ((select id from topics where code='No.002'), (select id from members where name='林伟强'), '林伟强', 'n8n 我一开就卡在 credentials,不知道从哪个流程开始练。', 0),
  ((select id from topics where code='No.002'), (select id from members where name='郑老师'), '郑老师', '先做最简单的:定时抓一个网页,发去 Telegram。跑通一条,再加东西。', 1),
  ((select id from topics where code='No.002'), (select id from members where name='陈美玲'), '陈美玲', '明白,先求跑通不求复杂。', 2);
