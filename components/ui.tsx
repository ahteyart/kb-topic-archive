import {
  CheckCircle2,
  MessageCircle,
  Clock,
  type LucideIcon,
} from "lucide-react"
import {
  C,
  sans,
  mono,
  catColor,
  avatarColor,
  STATUS_COLORS,
} from "@/lib/tokens"
import type { TopicStatus, MemberRole } from "@/lib/database.types"

const STATUS_ICON: Record<TopicStatus, LucideIcon> = {
  已结论: CheckCircle2,
  讨论中: MessageCircle,
  待跟进: Clock,
}

export function StatusPill({ status }: { status: TopicStatus }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS["待跟进"]
  const Icon = STATUS_ICON[status] ?? Clock
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{
        background: s.bg,
        color: s.fg,
        fontFamily: sans,
        fontSize: 12,
        padding: "3px 9px",
        fontWeight: 500,
      }}
    >
      <Icon size={12} strokeWidth={2.4} /> {status}
    </span>
  )
}

export function CatDot({ category }: { category?: string | null }) {
  return (
    <span
      className="rounded-full"
      style={{
        width: 8,
        height: 8,
        background: catColor(category),
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  )
}

export function Avatar({ name, size = 30 }: { name?: string | null; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        color: "#fff",
        fontSize: size * 0.42,
        fontWeight: 600,
        fontFamily: sans,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {(name || "?").trim().charAt(0)}
    </span>
  )
}

export function RoleBadge({
  role,
  small,
}: {
  role?: MemberRole | null
  small?: boolean
}) {
  if (role !== "admin") return null
  return (
    <span
      style={{
        background: C.brassSoft,
        color: C.brass,
        fontSize: small ? 10 : 10.5,
        fontWeight: 600,
        padding: small ? "0px 5px" : "1px 6px",
        borderRadius: 5,
        fontFamily: sans,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      管理人
    </span>
  )
}

export function CohortChip({ cohort }: { cohort?: string | null }) {
  if (!cohort) return null
  return (
    <span
      style={{
        background: C.bg,
        border: `1px solid ${C.line}`,
        color: C.inkSoft,
        fontSize: 11,
        padding: "1px 7px",
        borderRadius: 5,
        fontFamily: sans,
        whiteSpace: "nowrap",
      }}
    >
      {cohort}
    </span>
  )
}

export function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 11,
        letterSpacing: 1.5,
        color: C.faint,
        textTransform: "uppercase",
        marginBottom: 8,
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  )
}

export function SideHeading({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize: 10,
        letterSpacing: 1.5,
        color: C.faint,
        textTransform: "uppercase",
        padding: "0 8px 8px",
      }}
    >
      {text}
    </div>
  )
}

export function Stat({
  n,
  label,
  color,
}: {
  n: number
  label: string
  color: string
}) {
  return (
    <div className="text-center" style={{ minWidth: 40 }}>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color }}>
        {n}
      </div>
      <div style={{ fontSize: 11, color: C.faint }}>{label}</div>
    </div>
  )
}
