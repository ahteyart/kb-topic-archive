# 课题知识库 · Topic Archive

马来西亚华人 SME AI 教育陪跑计划的**多人网页版课题知识库**。老师和学员在讨论中产生的「课题 + 答案」集中沉淀在这里,每一期学员都能搜索、浏览过往讨论,并追踪每位学员的参与积极度。

基于单人版原型 `reference/knowledge-base.jsx` 升级而来——交互、数据结构、「典籍档案」视觉风格都以它为准,存储从浏览器本地换成了 **Supabase**(多人、共享、带登录)。

## 技术栈

- **前端**:Next.js 16(App Router)+ TypeScript + React 19,Tailwind v4 + 内联样式
- **数据库 / 认证**:Supabase(Postgres + Auth + RLS)
- **AI 自动标签**:服务端 Route Handler 调用 DeepSeek(可切换 Claude);**API key 只在服务端**
- **部署**:Vercel

## 目录结构

```
app/
  page.tsx              入口:校验登录 → 渲染 KBApp(未登录跳 /login)
  login/page.tsx        管理人登录页
  api/ai-tags/route.ts  服务端 AI 标签(DeepSeek / Claude,key 不出服务端)
components/
  KBApp.tsx             主应用(原型移植:列表/详情/编辑/名录/积极度/学员页)
  ui.tsx                展示型原子组件(头像、状态徽章、色点…)
lib/
  tokens.ts             设计 token(C / serif / sans / mono / catColor / avatarColor / STATUS)
  store.ts              数据层:规范化 schema ↔ 原型的「按名字」数据结构互转
  auth.ts               取当前用户 + 角色
  supabase/             浏览器 / 服务端 / proxy 三个 Supabase 客户端
proxy.ts                Next 16 的鉴权中间件(旧称 middleware)
supabase/migrations/    数据库迁移(0001 建表、0002 RLS、0003 加固)
supabase/seed.sql       可选示例数据
```

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 与(可选)AI 的变量
npm run dev                  # http://localhost:3000
```

`.env.local` 需要:

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable / anon key(可暴露到浏览器) |
| `DEEPSEEK_API_KEY` | 服务端专用;留空则 AI 标签回退到本地英文关键词提取 |
| `ANTHROPIC_API_KEY` | 可选,想用 Claude 时填 |

> 三方 key 里只有前两个是 `NEXT_PUBLIC_`(公开)。`DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` **绝不要**加 `NEXT_PUBLIC_` 前缀,否则会被打进浏览器包。

## 数据库迁移怎么跑

`supabase/migrations/` 里三个文件按顺序执行即可。三选一:

- **Supabase Dashboard**:打开项目 → SQL Editor → 依次粘贴 `0001 → 0002 → 0003` 运行。
- **Supabase CLI**:`supabase link --project-ref <ref>` 后 `supabase db push`。
- **示例数据(可选)**:再跑一遍 `supabase/seed.sql`。

> 本项目已连到 Supabase 项目 `kb-topic-archive`(区域 ap-southeast-1),三个迁移和示例数据都已应用。

## 如何创建第一个管理员账号

应用区分两类使用者:**管理人**(可增删改)和**学员 / 只读**(仅浏览)。角色存在 `profiles.role`。

**方式 A — Supabase Dashboard(推荐)**
1. Authentication → Users → Add user,填邮箱 + 密码,勾选 Auto Confirm。
2. SQL Editor 里把该用户设为管理人:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '你的邮箱');
   ```
3. 用这个邮箱 / 密码在 `/login` 登录。

**方式 B — 已内置的开发管理员**
本项目已经预置了一个可直接登录的管理员(方便你马上试):

- 邮箱:`admin@kb.local`
- 密码:`KbAdmin!2026`

> ⚠️ 这是开发用的临时账号,**上线前请改密码或删掉**(Dashboard → Authentication → Users)。

新注册的用户默认是 `student`(只读)。要提升为管理人,重复方式 A 第 2 步即可。

## 如何导入学员

登录后进入 **学员名录 → 导入**,粘贴文本,每行一个人:

```
陈美玲, 012-3456789, 第1期
黄晓芳, 017-8899001, 第2期
郑老师, 019-7778888, 管理人
```

- 逗号、Tab、分号都能分隔,顺序不限;带「期」字样的当期数,带「管理人/老师/助教」等的当角色。
- 按号码去重合并(没号码则按名字)。
- 名录里的名字 / 号码会自动出现在课题的「发问 / 回答」选择里;凡在讨论记录里发过言的成员也会自动并入该课题的参与者。

## 从 WhatsApp 导入讨论

1. 手机上打开群聊 → 右上角 ⋮ → 更多 → **导出聊天记录** → 选「**不含媒体**」,得到 .txt 文件。
2. 登录后台 → 侧边栏「**WhatsApp 导入**」→ 上传 .txt 或直接粘贴内容。
3. 系统解析后显示消息数、发言人匹配情况(电话号码会自动对上名录成员),可按日期范围筛选。
4. 点「**AI 分段成课题草稿**」:AI 把聊天切分成课题(标题/分类/发问人/结论/标签),闲聊自动剔除。
5. 在**草稿箱**逐条审核:「编辑并入库」可先修改,「直接入库」一键成正式课题,「弃用」丢弃。
6. 语音/图片暂以「[媒体]」占位(转写为二期);全自动采集(Evolution API + n8n)为二期,届时草稿直接投递到同一个草稿箱。

## 部署到 Vercel

1. 推到 GitHub,在 Vercel 里 Import 这个仓库(框架自动识别为 Next.js)。
2. 在 Vercel 项目的 Environment Variables 里填上 `.env.local` 的四个变量。
3. Deploy。Supabase 那边无需额外配置(RLS 已开)。

## 权限模型(RLS)

- 所有**已登录**用户可读 `topics / members / cohorts / discussion_messages`。
- 仅 `role = 'admin'` 的用户可写(增删改),由 `public.is_admin()` + RLS 策略强制。
- 读策略默认限定为 `authenticated`,以保护名录里的电话号码等 PII。若要做「免登录公开只读前台」,把 `0002` 里的 `*_select` 策略改成 `to anon, authenticated`(注意这会公开数据)。学员登录方式仍待定,见下方 Roadmap。

## Roadmap(尚未做)

- 学员登录 / 只读入口的最终形态(各自登录 vs 每期共用只读入口)。
- pgvector 语义搜索(大白话搜旧课题)。
- 名录导出 CSV(按期导出)。
- WhatsApp 采集管道(Evolution API + n8n + Whisper → AI 分段成课题草稿 → 后台审核入库)。
