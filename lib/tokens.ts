// ---- design tokens (ported 1:1 from the prototype knowledge-base.jsx) ----
import type { TopicStatus } from "./database.types"

export const C = {
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  ink: "#1B2A4A",
  inkSoft: "#3A4664",
  muted: "#6B7488",
  faint: "#98A0B3",
  line: "#E4E7ED",
  lineSoft: "#EEF0F4",
  accent: "#0E7C7B",
  accentSoft: "#E6F2F1",
  brass: "#B4884D",
  brassSoft: "#F5EEE0",
  danger: "#B4453A",
} as const

export const sans =
  'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
// 应用户要求去掉宋体:标题不再用衬线,统一走无衬线(中文走苹方 / 微软雅黑)
export const serif = sans
export const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

const CAT_COLORS = [
  "#0E7C7B", "#3B5BA5", "#B4884D", "#8E5572",
  "#5B8266", "#C1662F", "#4A6FA5", "#7A6B9E",
]
export const catColor = (name?: string | null) => {
  if (!name) return C.muted
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CAT_COLORS[h % CAT_COLORS.length]
}

const AVATAR_COLORS = [
  "#3B5BA5", "#0E7C7B", "#B4884D", "#8E5572", "#5B8266",
  "#C1662F", "#4A6FA5", "#7A6B9E", "#2F6F6B",
]
export const avatarColor = (name?: string | null) => {
  let h = 0
  const s = name || ""
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// status colours (icons live in components/ui.tsx to keep this file plain data)
export const STATUS_COLORS: Record<TopicStatus, { fg: string; bg: string }> = {
  已结论: { fg: "#0E7C7B", bg: "#E6F2F1" },
  讨论中: { fg: "#B4884D", bg: "#F5EEE0" },
  待跟进: { fg: "#6B7488", bg: "#EEF0F4" },
}
export const STATUS_LIST: TopicStatus[] = ["讨论中", "已结论", "待跟进"]

// ---- helpers -------------------------------------------------------
export const digits = (s?: string | null) => (s || "").replace(/\D/g, "")
export const ROLE_RE = /管理|admin|老师|讲师|导师|助教|teacher|staff|工作人员/i

// parse pasted directory text: "名字, 号码, 期数 [, 角色]" per line
export type ParsedPerson = { name: string; phone: string; role: "student" | "admin"; cohort: string }
export const parsePeople = (text: string): ParsedPerson[] =>
  text
    .split(/\n+/)
    .map((line): ParsedPerson | null => {
      const parts = line.split(/[,，\t;；]+/).map((s) => s.trim()).filter(Boolean)
      if (!parts.length || !parts[0]) return null
      let role: "student" | "admin" = "student"
      let cohort = ""
      parts.slice(2).forEach((tok) => {
        if (ROLE_RE.test(tok)) role = "admin"
        else if (!cohort) cohort = tok
      })
      return { name: parts[0], phone: parts[1] || "", role, cohort }
    })
    .filter((p): p is ParsedPerson => p !== null)
