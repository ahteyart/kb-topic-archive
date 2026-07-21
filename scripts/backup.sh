#!/usr/bin/env bash
# 改动前手动备份生产库(结构 + 数据),存到本地 backups/(已在 .gitignore)。
#
# 用法(先从 Supabase 面板 → Project Settings → Database → Connection string 复制连接串):
#   SUPABASE_DB_URL="postgresql://postgres.xxx:密码@...pooler.supabase.com:5432/postgres" bash scripts/backup.sh
set -euo pipefail

: "${SUPABASE_DB_URL:?请先设置 SUPABASE_DB_URL(Supabase 面板 → Project Settings → Database → Connection string)}"

ts=$(date -u +%Y%m%d-%H%M)
mkdir -p backups
echo "→ 正在备份到 backups/…（结构 + 数据）"
npx --yes supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/schema-$ts.sql"
npx --yes supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "backups/data-$ts.sql"
echo "✓ 备份完成:"
echo "    backups/schema-$ts.sql"
echo "    backups/data-$ts.sql"
echo "  (恢复:先跑 schema 再跑 data;或直接把整份数据贴回 Supabase SQL Editor)"
