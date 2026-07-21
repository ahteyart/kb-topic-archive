<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 环境与安全改动规则(务必遵守)

这是一个**已经在生产使用**的系统(真实学员数据)。改动前先了解:

- **两个数据库**:
  - **生产库** `ugzxuubdwfaxybfpzmep`(kb-topic-archive):真实数据,**只有 Vercel Production 环境用它**。开发/测试**绝不**连它。
  - **测试库** `xpmuwpgnpwakthdrgrxx`(kb-topic-archive-staging):假数据。`.env.local`、`npm run dev`、Vercel Preview 都连它。所有验证在这里做。
- **改数据库结构**:先在**测试库**用 Supabase MCP `apply_migration` 验证,再对生产库应用;把 SQL 同步存进 `supabase/migrations/`。**迁移只加不减**(加表/加列安全;删列、改名、删数据前必须先备份)。
- **删数据 / 破坏性操作前**:先备份——`bash scripts/backup.sh`(需设 `SUPABASE_DB_URL`),或到 GitHub Actions 手动触发「每日数据库备份」。
- **上线流程**:本地(测试库)验证 → `npx vercel deploy`(预览,连测试库)再验证 → 才 `npx vercel --prod`。
- **回退**:代码出错用 `git revert <commit>` + 重新部署;界面类改动因此低风险。
- **一次只改一件事**,单独提交 + 部署。
- 千万**不要动 Vercel Production 的环境变量**(它指向生产库)。
