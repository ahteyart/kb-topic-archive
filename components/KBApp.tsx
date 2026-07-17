"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, ArrowLeft, Pencil, Trash2, X, BookOpen,
  ChevronRight, Menu, CheckCircle2, MessageCircle, Tag,
  Sparkles, Loader2, Users, HelpCircle, Contact, Upload, Phone, LogOut,
  CornerDownRight, UserCog, KeyRound,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  C, serif, sans, mono, catColor, avatarColor,
  STATUS_COLORS, STATUS_LIST, digits, parsePeople,
} from "@/lib/tokens"
import { Avatar, StatusPill, CatDot, RoleBadge, CohortChip, SectionLabel, SideHeading, Stat } from "@/components/ui"
import {
  loadTopics, loadPeople, saveTopic, deleteTopic as apiDeleteTopic,
  addMember, updateMember, deleteMember, importMembers,
  listUsers, createUser, updateUserRole, resetUserPassword, deleteUser,
  type Topic, type Person, type TopicDraft, type Message, type AppUser,
} from "@/lib/store"
import type { MemberRole, TopicStatus } from "@/lib/database.types"

// ---- small helpers -------------------------------------------------
const uid = () => Math.random().toString(36).slice(2, 10)
const findRole = (people: Person[], name: string): MemberRole | null => {
  const p = people.find((x) => x.name === name)
  return p ? p.role : null
}
const findPhone = (people: Person[], name: string) => people.find((x) => x.name === name)?.phone ?? ""
const findCohort = (people: Person[], name: string) => people.find((x) => x.name === name)?.cohort ?? ""

// offline fallback: pull English tool/product names + key terms
function localTags({ title, discussion, conclusion }: { title: string; discussion: string; conclusion: string }) {
  const text = [title, discussion, conclusion].join(" ")
  const eng = [...new Set(text.match(/[A-Za-z][A-Za-z0-9.\-]+/g) || [])].filter((w) => w.length > 1)
  return eng.slice(0, 5)
}
async function generateTags(draft: { title: string; discussion: string; conclusion: string; category: string }) {
  const res = await fetch("/api/ai-tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: draft.title, discussion: draft.discussion,
      conclusion: draft.conclusion, category: draft.category,
    }),
  })
  if (!res.ok) throw new Error("ai failed")
  const data = await res.json()
  if (data.fallback) return null
  return data as { tags: string[]; category: string | null }
}

type View = "list" | "detail" | "edit" | "roster" | "student" | "directory" | "users"

// ---- main ----------------------------------------------------------
export default function KBApp({ role, email }: { role: MemberRole; email: string | null }) {
  const router = useRouter()
  const canEdit = role === "admin"

  const [topics, setTopics] = useState<Topic[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [view, setView] = useState<View>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)
  const [detailFrom, setDetailFrom] = useState<View>("list")
  const [draft, setDraft] = useState<TopicDraft | null>(null)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TopicStatus | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [rosterRole, setRosterRole] = useState<"student" | "admin" | "all">("student")
  const [rosterCohort, setRosterCohort] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [t, p] = await Promise.all([loadTopics(), loadPeople()])
    setTopics(t)
    setPeople(p)
  }, [])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const categories = useMemo(() => {
    const m = new Map<string, number>()
    topics.forEach((t) => m.set(t.category || "未分类", (m.get(t.category || "未分类") || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [topics])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return topics
      .filter((t) => {
        if (catFilter && (t.category || "未分类") !== catFilter) return false
        if (statusFilter && t.status !== statusFilter) return false
        if (!q) return true
        const hay = [t.title, t.conclusion, t.discussion, t.code, t.cohort, (t.tags || []).join(" ")].join(" ").toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }, [topics, search, catFilter, statusFilter])

  const selected = topics.find((t) => t.id === selectedId)

  const students = useMemo(() => {
    type S = { name: string; asked: Topic[]; answered: Topic[]; role: MemberRole; phone: string; cohort: string }
    const m = new Map<string, S>()
    const ensure = (n: string): S => {
      if (!m.has(n)) m.set(n, { name: n, asked: [], answered: [], role: findRole(people, n) || "student", phone: findPhone(people, n), cohort: findCohort(people, n) })
      return m.get(n)!
    }
    people.forEach((p) => { const s = ensure(p.name); s.role = p.role; s.phone = p.phone; s.cohort = p.cohort || "" })
    topics.forEach((t) => {
      if (t.asker && t.asker.trim()) ensure(t.asker.trim()).asked.push(t)
      ;(t.contributors || []).forEach((c) => { if (c && c.trim()) ensure(c.trim()).answered.push(t) })
    })
    return [...m.values()]
      .map((s) => ({ ...s, total: new Set([...s.asked, ...s.answered].map((t) => t.id)).size, score: s.asked.length + s.answered.length }))
      .sort((a, b) => b.score - a.score || b.total - a.total)
  }, [topics, people])

  const cohorts = useMemo(() => [...new Set(people.map((p) => p.cohort).filter(Boolean))].sort(), [people])
  const activeStudent = students.find((s) => s.name === studentName)
  const rosterList = students.filter((s) => (rosterRole === "all" || s.role === rosterRole) && (!rosterCohort || s.cohort === rosterCohort))
  const maxScore = rosterList.reduce((m, s) => Math.max(m, s.score), 0) || 1

  const openTopic = (t: Topic, from: View) => { setSelectedId(t.id); setDetailFrom(from); setView("detail") }
  const openStudent = (name: string) => { setStudentName(name); setView("student") }

  const openNew = () => {
    setDraft({ id: null, title: "", category: "", cohort: "", tags: "", discussion: "", conclusion: "", status: "讨论中", asker: "", contributors: [], messages: [] })
    setView("edit")
  }
  const openEdit = (t: Topic) => {
    setDraft({ id: t.id, title: t.title, category: t.category, cohort: t.cohort, status: t.status, discussion: t.discussion, conclusion: t.conclusion, tags: (t.tags || []).join(", "), asker: t.asker || "", contributors: t.contributors || [], messages: (t.messages || []).map((m) => ({ ...m, replies: (m.replies || []).map((r) => ({ ...r })) })) })
    setView("edit")
  }
  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return
    setBusy(true)
    try {
      const id = await saveTopic(draft)
      await reload()
      setSelectedId(id); setDetailFrom("list"); setView("detail")
    } catch (e) {
      alert("保存失败:" + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const doDelete = async (id: string) => {
    setBusy(true)
    try {
      await apiDeleteTopic(id)
      await reload()
      setConfirmDel(null)
      if (selectedId === id) { setSelectedId(null); setView("list") }
    } catch (e) {
      alert("删除失败:" + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // member ops (wrapped to reload)
  const wrap = (fn: () => Promise<void>) => async () => { setBusy(true); try { await fn(); await reload() } catch (e) { alert((e as Error).message) } finally { setBusy(false) } }
  const onAddMember = (p: { name: string; phone?: string; role?: MemberRole; cohort?: string }) => wrap(() => addMember(p))()
  const onUpdateMember = (id: string, patch: { name: string; phone: string; role: MemberRole; cohort: string }) => wrap(() => updateMember(id, patch))()
  const onDeleteMember = (id: string) => wrap(() => deleteMember(id))()
  const onImportMembers = (list: { name: string; phone: string; role: MemberRole; cohort: string }[]) => wrap(() => importMembers(list, people))()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: sans, color: C.muted }}>
        正在打开知识库…
      </div>
    )
  }

  const inPeople = view === "roster" || view === "student" || view === "directory" || view === "users"

  return (
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: sans, color: C.ink }}>
      {/* Header */}
      <header className="sticky top-0" style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, zIndex: 30 }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ maxWidth: 1160, margin: "0 auto" }}>
          <button className="md:hidden kb-focus" onClick={() => setNavOpen((v) => !v)} style={{ border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: 4 }} aria-label="菜单">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2" style={{ cursor: "pointer" }} onClick={() => { setView("list"); setSelectedId(null) }}>
            <BookOpen size={22} style={{ color: C.accent }} strokeWidth={1.8} />
            <div>
              <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, letterSpacing: 0.3, color: C.ink, lineHeight: 1.1 }}>课题知识库</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: C.faint, letterSpacing: 1 }}>TOPIC ARCHIVE</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="relative" style={{ maxWidth: 340, flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
            <input className="kb-focus w-full" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索课题、答案或标签"
              style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 14, color: C.ink, width: "100%" }} />
          </div>
          {canEdit && (
            <button className="kb-focus" onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Plus size={16} strokeWidth={2.4} /> <span className="hidden md:inline">新增课题</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex" style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Sidebar */}
        <aside className={navOpen ? "block" : "hidden md:block"} style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${C.line}`, background: C.surface, minHeight: "calc(100vh - 57px)" }}>
          <nav className="kb-scroll" style={{ position: "sticky", top: 57, padding: "18px 14px", maxHeight: "calc(100vh - 57px)", overflowY: "auto", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 57px)" }}>
            <SideHeading text="视图" />
            <SideItem label="课题库" count={topics.length} icon={BookOpen} active={!inPeople} onClick={() => { setView("list"); setNavOpen(false) }} />
            <SideItem label="学员积极度" count={students.length} icon={Users} active={view === "roster" || view === "student"} onClick={() => { setView("roster"); setNavOpen(false) }} />
            <SideItem label="学员名录" count={people.length} icon={Contact} active={view === "directory"} onClick={() => { setView("directory"); setNavOpen(false) }} />
            {canEdit && (
              <SideItem label="用户管理" icon={UserCog} active={view === "users"} onClick={() => { setView("users"); setNavOpen(false) }} />
            )}

            {!inPeople && (
              <>
                <div style={{ height: 18 }} />
                <SideHeading text="分类" />
                <SideItem label="全部课题" count={topics.length} active={!catFilter} onClick={() => { setCatFilter(null); setNavOpen(false) }} />
                {categories.map(([name, count]) => (
                  <SideItem key={name} label={name} count={count} dot={catColor(name)} active={catFilter === name} onClick={() => { setCatFilter(name); setNavOpen(false) }} />
                ))}
                <div style={{ height: 18 }} />
                <SideHeading text="状态" />
                <SideItem label="全部" active={!statusFilter} onClick={() => setStatusFilter(null)} />
                {STATUS_LIST.map((s) => (
                  <SideItem key={s} label={s} active={statusFilter === s} statusDot={STATUS_COLORS[s].fg} onClick={() => setStatusFilter(s)} />
                ))}
              </>
            )}

            <div style={{ flex: 1, minHeight: 18 }} />
            <div style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: 12, marginTop: 12 }}>
              <div className="flex items-center gap-2" style={{ padding: "0 8px 8px" }}>
                <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                {canEdit ? <RoleBadge role="admin" small /> : <span style={{ fontSize: 10.5, color: C.faint }}>只读</span>}
              </div>
              <button className="kb-focus w-full" onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: C.muted, borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
                <LogOut size={15} strokeWidth={1.9} /> 退出登录
              </button>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1" style={{ minWidth: 0, padding: "22px 20px 60px" }}>
          {view === "list" && (
            <ListView topics={filtered} total={topics.length} onOpen={(t) => openTopic(t, "list")} activeCat={catFilter} activeStatus={statusFilter} search={search} onNew={openNew} canEdit={canEdit} />
          )}
          {view === "detail" && selected && (
            <DetailView t={selected} people={people} canEdit={canEdit} onBack={() => setView(detailFrom === "student" ? "student" : "list")} onEdit={() => openEdit(selected)} onDelete={() => setConfirmDel(selected.id)} onStudent={openStudent} />
          )}
          {view === "detail" && !selected && (
            <Empty title="找不到这条课题" body="可能已被删除。" cta="返回课题库" onCta={() => setView("list")} />
          )}
          {view === "edit" && draft && (
            <EditView draft={draft} setDraft={setDraft} onSave={saveDraft} busy={busy} onCancel={() => { if (draft.id) { setSelectedId(draft.id); setView("detail") } else setView("list") }} categories={categories.map((c) => c[0])} people={people} />
          )}
          {view === "roster" && (
            <RosterView students={rosterList} maxScore={maxScore} onOpen={openStudent} role={rosterRole} setRole={setRosterRole} counts={{ student: students.filter((s) => s.role === "student").length, admin: students.filter((s) => s.role === "admin").length, all: students.length }} cohort={rosterCohort} setCohort={setRosterCohort} cohorts={cohorts} />
          )}
          {view === "directory" && (
            <DirectoryView people={people} canEdit={canEdit} onAdd={onAddMember} onUpdate={onUpdateMember} onDelete={onDeleteMember} onImport={onImportMembers} />
          )}
          {view === "users" && canEdit && <UsersView selfEmail={email} />}
          {view === "student" && activeStudent && (
            <StudentView s={activeStudent} onBack={() => setView("roster")} onOpenTopic={(t) => openTopic(t, "student")} />
          )}
          {view === "student" && !activeStudent && (
            <Empty title="没有这位学员的记录" body="可能相关课题已被删除。" cta="返回学员列表" onCta={() => setView("roster")} />
          )}
        </main>
      </div>

      {/* delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(27,42,74,0.35)", zIndex: 50, padding: 20 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(27,42,74,0.2)" }}>
            <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>删除这条课题?</div>
            <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>删除后无法恢复。这条讨论记录和答案会一起移除。</div>
            <div className="flex justify-end gap-3">
              <button className="kb-focus" onClick={() => setConfirmDel(null)} style={{ background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button className="kb-focus" onClick={() => doDelete(confirmDel)} disabled={busy} style={{ background: C.danger, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- sidebar item (interactive) ------------------------------------
function SideItem({ label, count, active, dot, statusDot, icon: Icon, onClick }: {
  label: string; count?: number; active?: boolean; dot?: string; statusDot?: string
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; onClick: () => void
}) {
  return (
    <button className="kb-focus w-full" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", cursor: "pointer",
        background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.inkSoft,
        borderRadius: 8, padding: "8px 10px", fontSize: 13.5, fontWeight: active ? 600 : 400, marginBottom: 2 }}>
      {Icon && <Icon size={15} strokeWidth={1.9} style={{ flexShrink: 0 }} />}
      {dot && <span className="rounded-full" style={{ width: 8, height: 8, background: dot, flexShrink: 0 }} />}
      {statusDot && <span className="rounded-full" style={{ width: 8, height: 8, background: statusDot, flexShrink: 0 }} />}
      <span className="truncate" style={{ flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontFamily: mono, fontSize: 11, color: active ? C.accent : C.faint }}>{count}</span>}
    </button>
  )
}

// ---- list view -----------------------------------------------------
function ListView({ topics, total, onOpen, activeCat, activeStatus, search, onNew, canEdit }: {
  topics: Topic[]; total: number; onOpen: (t: Topic) => void; activeCat: string | null; activeStatus: TopicStatus | null; search: string; onNew: () => void; canEdit: boolean
}) {
  if (total === 0) {
    return <Empty title="知识库还是空的" body="把老师和学生的第一次讨论、还有最后得出的答案记录进来。之后每一期的新生都能搜到、接着往下问。" cta={canEdit ? "记录第一条课题" : undefined} onCta={onNew} />
  }
  if (topics.length === 0) {
    return <Empty title="没有匹配的课题" body={`没有找到符合当前条件的记录${search ? "。换个关键词试试" : ""}。`} />
  }
  return (
    <div>
      <div className="flex items-baseline gap-2" style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>{activeCat || "全部课题"}</h1>
        <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{topics.length} 条{activeStatus ? ` · ${activeStatus}` : ""}</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {topics.map((t) => (
          <article key={t.id} onClick={() => onOpen(t)} className="kb-focus" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(t)}
            style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, transform .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.brass, fontWeight: 600 }}>{t.code}</span>
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: C.muted }}><CatDot category={t.category} /> {t.category || "未分类"}</span>
              {t.cohort && <span style={{ fontSize: 12, color: C.faint }}>· {t.cohort}</span>}
              <span className="flex-1" />
              <StatusPill status={t.status} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 17, fontWeight: 400, color: C.ink, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{t.title}</h2>
            {t.conclusion && (
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.conclusion}</p>
            )}
            <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
              {t.asker && (
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: C.inkSoft }}>
                  <Avatar name={t.asker} size={20} /> {t.asker} 发问
                </span>
              )}
              {t.contributors?.length > 0 && <span style={{ fontSize: 12, color: C.faint }}>· {t.contributors.length} 人参与</span>}
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1" style={{ color: C.accent, fontSize: 13 }}>阅读 <ChevronRight size={14} /></span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// ---- detail view ---------------------------------------------------
function DetailView({ t, people, canEdit, onBack, onEdit, onDelete, onStudent }: {
  t: Topic; people: Person[]; canEdit: boolean; onBack: () => void; onEdit: () => void; onDelete: () => void; onStudent: (name: string) => void
}) {
  const hasPeople = (t.asker && t.asker.trim()) || (t.contributors && t.contributors.length > 0)
  return (
    <div style={{ maxWidth: 720 }}>
      <button className="kb-focus" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13.5, marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> 返回
      </button>

      <div className="flex items-center gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 13, color: C.brass, fontWeight: 600 }}>{t.code}</span>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, color: C.inkSoft }}><CatDot category={t.category} /> {t.category || "未分类"}</span>
        {t.cohort && <span style={{ fontSize: 13, color: C.faint }}>· {t.cohort}</span>}
        <span className="flex-1" />
        <StatusPill status={t.status} />
      </div>

      <h1 style={{ fontFamily: serif, fontSize: 18, fontWeight: 400, color: C.ink, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{t.title}</h1>

      {hasPeople && (
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap", marginBottom: 22, paddingBottom: 20, borderBottom: `1px solid ${C.lineSoft}` }}>
          {t.asker && t.asker.trim() && (
            <button className="kb-focus" onClick={() => onStudent(t.asker.trim())} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 20, padding: "5px 12px 5px 5px", cursor: "pointer" }}>
              <Avatar name={t.asker} size={24} />
              <span style={{ fontSize: 13.5, color: C.ink }}><b style={{ fontWeight: 600 }}>{t.asker}</b> <span style={{ color: C.muted }}>发问</span></span>
              <RoleBadge role={findRole(people, t.asker.trim())} small />
            </button>
          )}
          {t.contributors?.length > 0 && (
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: C.faint }}>回答 / 参与</span>
              {t.contributors.map((c) => (
                <button key={c} className="kb-focus" onClick={() => onStudent(c)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}>
                  <Avatar name={c} size={22} />
                  <span style={{ fontSize: 13, color: C.inkSoft }}>{c}</span>
                  <RoleBadge role={findRole(people, c)} small />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {t.discussion && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="讨论过程" />
          <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{t.discussion}</p>
        </section>
      )}

      {t.messages?.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text={`讨论记录 · ${t.messages.reduce((n, m) => n + 1 + (m.replies?.length ?? 0), 0)} 条发言`} />
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            {t.messages.map((m) => (
              <MsgBubble key={m.id} m={m} people={people} onStudent={onStudent} />
            ))}
          </div>
        </section>
      )}

      <section style={{ background: C.accentSoft, border: `1px solid #CDE6E4`, borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
          <CheckCircle2 size={15} style={{ color: C.accent }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.5, color: C.accent, textTransform: "uppercase", fontWeight: 600 }}>老师结论 · 答案</span>
        </div>
        <p style={{ fontSize: 15.5, color: C.ink, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{t.conclusion || "还没有记录结论。"}</p>
      </section>

      {t.tags?.length > 0 && (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 24 }}>
          <Tag size={14} style={{ color: C.faint }} />
          {t.tags.map((tag) => (
            <span key={tag} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 9px", fontSize: 12.5, color: C.inkSoft }}>{tag}</span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3" style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: 18 }}>
          <button className="kb-focus" onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}>
            <Pencil size={14} /> 编辑
          </button>
          <button className="kb-focus" onClick={onDelete} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: C.danger, border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 14, cursor: "pointer" }}>
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}
    </div>
  )
}

// one discussion bubble + its one-level replies (indented)
function MsgBubble({ m, people, onStudent, reply }: { m: Message; people: Person[]; onStudent: (name: string) => void; reply?: boolean }) {
  const mrole = findRole(people, m.speaker)
  return (
    <div className="flex" style={{ gap: 10, alignItems: "flex-start" }}>
      <button className="kb-focus" onClick={() => m.speaker && onStudent(m.speaker)} style={{ background: "transparent", border: "none", padding: 0, cursor: m.speaker ? "pointer" : "default", flexShrink: 0, marginTop: 2 }}>
        <Avatar name={m.speaker || "?"} size={reply ? 26 : 30} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 3, flexWrap: "wrap" }}>
          <button className="kb-focus" onClick={() => m.speaker && onStudent(m.speaker)} style={{ background: "transparent", border: "none", padding: 0, cursor: m.speaker ? "pointer" : "default", fontSize: reply ? 13 : 13.5, fontWeight: 600, color: mrole === "admin" ? C.brass : C.ink }}>
            {m.speaker || "未署名"}
          </button>
          <RoleBadge role={mrole} small />
        </div>
        <div style={{ background: mrole === "admin" ? C.brassSoft : C.surface, border: `1px solid ${mrole === "admin" ? "#EADFC6" : C.line}`, borderRadius: "3px 12px 12px 12px", padding: reply ? "7px 11px" : "9px 13px", fontSize: reply ? 13.5 : 14.5, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {m.text}
        </div>
        {!reply && (m.replies?.length ?? 0) > 0 && (
          <div style={{ marginTop: 10, marginLeft: 4, paddingLeft: 14, borderLeft: `2px solid ${C.lineSoft}`, display: "grid", gap: 10 }}>
            {m.replies!.map((r) => (
              <MsgBubble key={r.id} m={r} people={people} onStudent={onStudent} reply />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- edit view -----------------------------------------------------
function EditView({ draft, setDraft, onSave, onCancel, categories, people, busy }: {
  draft: TopicDraft; setDraft: (d: TopicDraft) => void; onSave: () => void; onCancel: () => void; categories: string[]; people: Person[]; busy: boolean
}) {
  const set = (k: keyof TopicDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value })
  const [tagging, setTagging] = useState<"idle" | "loading" | "error">("idle")
  const inputStyle: React.CSSProperties = { width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 14.5, color: C.ink, lineHeight: 1.6 }
  const canTag = (draft.title + draft.discussion + draft.conclusion).trim().length > 3

  const msgs = draft.messages
  const addMsg = () => setDraft({ ...draft, messages: [...msgs, { id: uid(), speaker: draft.asker || "", text: "", replies: [] }] })
  const updateMsg = (i: number, patch: Partial<Message>) => setDraft({ ...draft, messages: msgs.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  const removeMsg = (i: number) => setDraft({ ...draft, messages: msgs.filter((_, j) => j !== i) })
  const addReply = (i: number) => setDraft({ ...draft, messages: msgs.map((m, j) => (j === i ? { ...m, replies: [...(m.replies ?? []), { id: uid(), speaker: "", text: "" }] } : m)) })
  const updateReply = (i: number, k: number, patch: Partial<Message>) => setDraft({ ...draft, messages: msgs.map((m, j) => (j === i ? { ...m, replies: (m.replies ?? []).map((r, l) => (l === k ? { ...r, ...patch } : r)) } : m)) })
  const removeReply = (i: number, k: number) => setDraft({ ...draft, messages: msgs.map((m, j) => (j === i ? { ...m, replies: (m.replies ?? []).filter((_, l) => l !== k) } : m)) })

  const autoTag = async () => {
    setTagging("loading")
    try {
      let result: { tags: string[]; category: string | null } | null = null
      try { result = await generateTags(draft) } catch { result = null }
      let newTags = result && Array.isArray(result.tags) ? result.tags : null
      if (!newTags || newTags.length === 0) newTags = localTags(draft)
      const existing = draft.tags.split(",").map((s) => s.trim()).filter(Boolean)
      const merged = [...new Set([...existing, ...newTags.map((s) => String(s).trim()).filter(Boolean)])]
      if (merged.length === existing.length && !result) { setTagging("error"); return }
      setDraft({ ...draft, tags: merged.join(", "), category: draft.category.trim() || (result && result.category ? String(result.category).trim() : "") })
      setTagging("idle")
    } catch {
      setTagging("error")
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>{draft.id ? "编辑课题" : "新增课题"}</h1>
        <button className="kb-focus" onClick={onCancel} style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 4 }} aria-label="关闭"><X size={20} /></button>
      </div>

      <Field label="课题讨论" required>
        <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 120, resize: "vertical", lineHeight: 1.7 }} value={draft.title} onChange={set("title")} placeholder="这次讨论的是什么?可以换行分段写。" />
      </Field>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="分类">
          <input className="kb-focus" style={inputStyle} value={draft.category} onChange={set("category")} placeholder="例如:AI工具应用" list="cat-list" />
          <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="期数">
          <input className="kb-focus" style={inputStyle} value={draft.cohort} onChange={set("cohort")} placeholder="例如:第2期" />
        </Field>
      </div>

      <Field label="状态">
        <select className="kb-focus" style={inputStyle} value={draft.status} onChange={set("status")}>
          {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="发问学员" hint="从名录里选,也可选管理人">
          <PeoplePicker people={people} value={draft.asker} onChange={(v) => setDraft({ ...draft, asker: v as string })} placeholder="输入名字或号码" />
        </Field>
        <Field label="回答 / 参与" hint="可多选,含管理人">
          <PeoplePicker people={people} multi value={draft.contributors} onChange={(v) => setDraft({ ...draft, contributors: v as string[] })} placeholder="输入名字或号码" />
        </Field>
      </div>

      <Field label="讨论过程" hint="可选:简单概括来龙去脉">
        <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={draft.discussion} onChange={set("discussion")} placeholder="一句话背景摘要(下面可逐条记录每个人的发言)" />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 8 }}>
          讨论记录<span style={{ fontWeight: 400, color: C.faint, marginLeft: 8, fontSize: 12.5 }}>逐条记下每个人说了什么,发言人从名录选</span>
        </label>
        <div style={{ display: "grid", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={m.id || i} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PeoplePicker people={people} value={m.speaker} onChange={(v) => updateMsg(i, { speaker: v as string })} placeholder="谁说的?" />
                </div>
                <button className="kb-focus" onClick={() => removeMsg(i)} aria-label="删除这条发言" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6, flexShrink: 0 }}><Trash2 size={15} /></button>
              </div>
              <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 52, resize: "vertical" }} value={m.text} onChange={(e) => updateMsg(i, { text: e.target.value })} placeholder="TA 说了什么…" />

              {(m.replies ?? []).length > 0 && (
                <div style={{ marginTop: 10, marginLeft: 14, paddingLeft: 12, borderLeft: `2px solid ${C.line}`, display: "grid", gap: 8 }}>
                  {(m.replies ?? []).map((r, k) => (
                    <div key={r.id || k} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <PeoplePicker people={people} value={r.speaker} onChange={(v) => updateReply(i, k, { speaker: v as string })} placeholder="谁回复的?" />
                        </div>
                        <button className="kb-focus" onClick={() => removeReply(i, k)} aria-label="删除这条回复" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6, flexShrink: 0 }}><Trash2 size={14} /></button>
                      </div>
                      <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 44, resize: "vertical" }} value={r.text} onChange={(e) => updateReply(i, k, { text: e.target.value })} placeholder="回复内容…" />
                    </div>
                  ))}
                </div>
              )}
              <button className="kb-focus" onClick={() => addReply(i)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: C.accent, border: "none", cursor: "pointer", fontSize: 12.5, padding: "8px 2px 2px", marginLeft: (m.replies ?? []).length ? 14 : 0 }}>
                <CornerDownRight size={13} /> 回复
              </button>
            </div>
          ))}
        </div>
        <button className="kb-focus" onClick={addMsg} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.accent, border: `1px dashed #BCD9D7`, borderRadius: 9, padding: "9px 14px", fontSize: 13.5, cursor: "pointer", marginTop: msgs.length ? 10 : 0, width: "100%", justifyContent: "center" }}>
          <Plus size={15} /> 添加一条发言
        </button>
      </div>

      <Field label="老师结论 · 答案" hint="这是新生最想看到的部分,写清楚可执行的结论">
        <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 130, resize: "vertical" }} value={draft.conclusion} onChange={set("conclusion")} placeholder="最后得出的答案、做法或建议" />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6, gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>
            标签<span style={{ fontWeight: 400, color: C.faint, marginLeft: 8, fontSize: 12.5 }}>用逗号分隔,方便搜索</span>
          </label>
          <button className="kb-focus" onClick={autoTag} disabled={!canTag || tagging === "loading"} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.accentSoft, color: C.accent, border: "1px solid #CDE6E4", borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", cursor: canTag && tagging !== "loading" ? "pointer" : "not-allowed", opacity: canTag ? 1 : 0.5 }}>
            {tagging === "loading" ? <Loader2 size={13} className="kb-spin" /> : <Sparkles size={13} />}
            {tagging === "loading" ? "生成中…" : "AI 自动生成"}
          </button>
        </div>
        <input className="kb-focus" style={inputStyle} value={draft.tags} onChange={set("tags")} placeholder="点右上角一键生成,或手动输入:文案, ChatGPT, 营销" />
        {tagging === "error" && <div style={{ fontSize: 12.5, color: C.danger, marginTop: 6 }}>生成失败,请再试一次,或先手动输入标签。</div>}
        {!canTag && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>先填一点标题或内容,就能自动生成标签。</div>}
      </div>

      <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
        <button className="kb-focus" onClick={onSave} disabled={!draft.title.trim() || busy} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: draft.title.trim() && !busy ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14.5, fontWeight: 500, cursor: draft.title.trim() && !busy ? "pointer" : "not-allowed" }}>
          {busy && <Loader2 size={14} className="kb-spin" />}
          {draft.id ? "保存修改" : "保存课题"}
        </button>
        <button className="kb-focus" onClick={onCancel} style={{ background: "transparent", color: C.muted, border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 14.5, cursor: "pointer" }}>取消</button>
      </div>
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.brass }}> *</span>}
        {hint && <span style={{ fontWeight: 400, color: C.faint, marginLeft: 8, fontSize: 12.5 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ---- empty state ---------------------------------------------------
function Empty({ title, body, cta, onCta }: { title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: "80px 20px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <BookOpen size={26} style={{ color: C.accent }} strokeWidth={1.6} />
      </div>
      <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, marginBottom: cta ? 24 : 0 }}>{body}</p>
      {cta && onCta && (
        <button className="kb-focus" onClick={onCta} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14.5, cursor: "pointer" }}>
          <Plus size={16} /> {cta}
        </button>
      )}
    </div>
  )
}

// ---- roster (student engagement) -----------------------------------
type StudentAgg = { name: string; asked: Topic[]; answered: Topic[]; role: MemberRole; phone: string; cohort: string; total: number; score: number }

function RosterView({ students, maxScore, onOpen, role, setRole, counts, cohort, setCohort, cohorts }: {
  students: StudentAgg[]; maxScore: number; onOpen: (name: string) => void
  role: "student" | "admin" | "all"; setRole: (v: "student" | "admin" | "all") => void
  counts: { student: number; admin: number; all: number }; cohort: string | null; setCohort: (v: string | null) => void; cohorts: string[]
}) {
  const Seg = ({ val, label }: { val: "student" | "admin" | "all"; label: string }) => (
    <button className="kb-focus" onClick={() => setRole(val)} style={{ background: role === val ? C.ink : "transparent", color: role === val ? "#fff" : C.inkSoft, border: role === val ? "none" : `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: role === val ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>{counts[val]}</span>
    </button>
  )
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="flex items-baseline gap-2" style={{ marginBottom: 6 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>学员积极度</h1>
        <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{students.length} 位</span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>按参与次数(发问 + 回答)排序,活跃度最低的排在最后。点开可看到每个人的所有发问和回答。</p>
      <div className="flex items-center gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <Seg val="student" label="学员" />
        <Seg val="admin" label="管理人" />
        <Seg val="all" label="全部" />
        {cohorts.length > 0 && (
          <select className="kb-focus" value={cohort || ""} onChange={(e) => setCohort(e.target.value || null)} style={{ background: cohort ? C.accentSoft : C.surface, color: cohort ? C.accent : C.inkSoft, border: `1px solid ${cohort ? "#CDE6E4" : C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", marginLeft: 4 }}>
            <option value="">全部期数</option>
            {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ padding: "60px 20px", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Users size={24} style={{ color: C.accent }} strokeWidth={1.6} />
          </div>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>这一类还没有人。到「学员名录」导入学员并标好期数,或在课题里填上发问 / 参与的人,这里就会自动统计。</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {students.map((s, i) => (
            <article key={s.name} onClick={() => onOpen(s.name)} className="kb-focus" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(s.name)}
              style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
              <span style={{ fontFamily: mono, fontSize: 13, color: C.faint, width: 22, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
              <Avatar name={s.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{s.name}</span>
                  <RoleBadge role={s.role} small />
                  {s.cohort && <CohortChip cohort={s.cohort} />}
                  {s.phone && <span style={{ fontFamily: mono, fontSize: 11.5, color: C.faint }}>{s.phone}</span>}
                </div>
                <div style={{ height: 6, background: C.lineSoft, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(4, (s.score / maxScore) * 100)}%`, height: "100%", background: s.score === 0 ? C.line : C.accent, borderRadius: 4 }} />
                </div>
              </div>
              <div className="flex items-center gap-4" style={{ flexShrink: 0 }}>
                <Stat n={s.asked.length} label="发问" color={C.brass} />
                <Stat n={s.answered.length} label="回答" color={C.accent} />
              </div>
              <ChevronRight size={16} style={{ color: C.faint, flexShrink: 0 }} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- single student ------------------------------------------------
function StudentView({ s, onBack, onOpenTopic }: { s: StudentAgg; onBack: () => void; onOpenTopic: (t: Topic) => void }) {
  const Row = ({ t }: { t: Topic }) => (
    <button className="kb-focus w-full" onClick={() => onOpenTopic(t)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8 }}>
      <span style={{ fontFamily: mono, fontSize: 11.5, color: C.brass, fontWeight: 600, flexShrink: 0 }}>{t.code}</span>
      <span style={{ fontSize: 14, color: C.ink, flex: 1, minWidth: 0, lineHeight: 1.45 }}>{t.title}</span>
      <StatusPill status={t.status} />
    </button>
  )
  return (
    <div style={{ maxWidth: 760 }}>
      <button className="kb-focus" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13.5, marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> 返回学员列表
      </button>

      <div className="flex items-center gap-4" style={{ marginBottom: 24 }}>
        <Avatar name={s.name} size={54} />
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 4, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: C.ink }}>{s.name}</h1>
            <RoleBadge role={s.role} />
            {s.cohort && <CohortChip cohort={s.cohort} />}
          </div>
          {s.phone && <div className="flex items-center gap-1.5" style={{ fontSize: 13, color: C.muted, marginBottom: 4, fontFamily: mono }}><Phone size={12} /> {s.phone}</div>}
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: C.muted }}>
            <span style={{ color: C.brass, fontWeight: 600 }}>发问 {s.asked.length}</span>
            <span style={{ color: C.accent, fontWeight: 600 }}>回答 {s.answered.length}</span>
            <span>· 共参与 {s.total} 个课题</span>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 28 }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
          <HelpCircle size={15} style={{ color: C.brass }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: C.brass, textTransform: "uppercase", fontWeight: 600 }}>TA 的发问 · {s.asked.length}</span>
        </div>
        {s.asked.length > 0 ? s.asked.map((t) => <Row key={t.id} t={t} />) : <p style={{ fontSize: 13.5, color: C.faint }}>还没有以发问者身份记录的课题。</p>}
      </section>

      <section>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
          <MessageCircle size={15} style={{ color: C.accent }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: C.accent, textTransform: "uppercase", fontWeight: 600 }}>TA 的回答 / 参与 · {s.answered.length}</span>
        </div>
        {s.answered.length > 0 ? s.answered.map((t) => <Row key={t.id} t={t} />) : <p style={{ fontSize: 13.5, color: C.faint }}>还没有以参与者身份记录的课题。</p>}
      </section>
    </div>
  )
}

// ---- directory -----------------------------------------------------
function DirectoryView({ people, canEdit, onAdd, onUpdate, onDelete, onImport }: {
  people: Person[]; canEdit: boolean
  onAdd: (p: { name: string; phone?: string; role?: MemberRole; cohort?: string }) => void
  onUpdate: (id: string, patch: { name: string; phone: string; role: MemberRole; cohort: string }) => void
  onDelete: (id: string) => void
  onImport: (list: { name: string; phone: string; role: MemberRole; cohort: string }[]) => void
}) {
  const [q, setQ] = useState("")
  const [cohortFilter, setCohortFilter] = useState("")
  const [mode, setMode] = useState<"list" | "import" | "add">("list")
  const [raw, setRaw] = useState("")
  const [form, setForm] = useState<{ name: string; phone: string; role: MemberRole; cohort: string }>({ name: "", phone: "", role: "student", cohort: "" })
  const [editId, setEditId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Person | null>(null)

  const cohorts = [...new Set(people.map((p) => p.cohort).filter(Boolean))].sort()
  const ql = q.trim().toLowerCase()
  const shown = people.filter((p) => {
    if (cohortFilter && (p.cohort || "") !== cohortFilter) return false
    if (!ql) return true
    return p.name.toLowerCase().includes(ql) || (!!digits(q) && digits(p.phone).includes(digits(q)))
  })
  const preview = mode === "import" ? parsePeople(raw) : []

  const inputStyle: React.CSSProperties = { width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: C.ink }

  const submitForm = () => {
    if (!form.name.trim()) return
    if (editId) onUpdate(editId, { name: form.name.trim(), phone: form.phone.trim(), role: form.role, cohort: form.cohort.trim() })
    else onAdd(form)
    setForm({ name: "", phone: "", role: "student", cohort: "" }); setEditId(null); setMode("list")
  }
  const startEdit = (p: Person) => { setForm({ name: p.name, phone: p.phone, role: p.role, cohort: p.cohort || "" }); setEditId(p.id); setMode("add") }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
        <div className="flex items-baseline gap-2">
          <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>学员名录</h1>
          <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{people.length} 人</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button className="kb-focus" onClick={() => { setMode(mode === "import" ? "list" : "import"); setEditId(null) }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 13px", fontSize: 13.5, cursor: "pointer" }}>
              <Upload size={15} /> 导入
            </button>
            <button className="kb-focus" onClick={() => { setForm({ name: "", phone: "", role: "student", cohort: "" }); setEditId(null); setMode(mode === "add" ? "list" : "add") }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 13.5, cursor: "pointer" }}>
              <Plus size={15} /> 新增
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>用名字或联络号码搜索。名字和号码会自动出现在课题的发问 / 回答选择里。</p>

      {canEdit && mode === "import" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>批量导入</div>
          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
            每行一个人,格式:<span style={{ fontFamily: mono, color: C.inkSoft }}>名字, 号码, 期数</span>。期数如「第2期」;想标管理人 / 老师就再加一列「管理人」。逗号、Tab 都能分隔,顺序不限。
          </p>
          <textarea className="kb-focus" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"陈美玲, 012-3456789, 第1期\n黄晓芳, 017-8899001, 第2期\n郑老师, 019-7778888, 管理人"} style={{ ...inputStyle, minHeight: 130, resize: "vertical", fontFamily: mono, lineHeight: 1.7 }} />
          <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
            <button className="kb-focus" onClick={() => { if (preview.length) { onImport(preview); setRaw(""); setMode("list") } }} disabled={!preview.length} style={{ background: preview.length ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 14, cursor: preview.length ? "pointer" : "not-allowed" }}>
              导入 {preview.length || ""} 人
            </button>
            <button className="kb-focus" onClick={() => { setRaw(""); setMode("list") }} style={{ background: "transparent", color: C.muted, border: "none", padding: "9px 8px", fontSize: 14, cursor: "pointer" }}>取消</button>
            {raw.trim() && <span style={{ fontSize: 12.5, color: C.faint }}>识别到 {preview.length} 行有效记录</span>}
          </div>
        </div>
      )}

      {canEdit && mode === "add" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{editId ? "编辑" : "新增"}成员</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input className="kb-focus" style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="名字" />
            <input className="kb-focus" style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="联络号码" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, alignItems: "center" }}>
            <input className="kb-focus" style={inputStyle} value={form.cohort} onChange={(e) => setForm({ ...form, cohort: e.target.value })} placeholder="期数,例如 第1期" list="cohort-list" />
            <datalist id="cohort-list">{cohorts.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="flex items-center gap-2">
              {([["student", "学员"], ["admin", "管理人"]] as const).map(([v, l]) => (
                <button key={v} className="kb-focus" onClick={() => setForm({ ...form, role: v })} style={{ background: form.role === v ? C.ink : "transparent", color: form.role === v ? "#fff" : C.inkSoft, border: form.role === v ? "none" : `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="kb-focus" onClick={submitForm} disabled={!form.name.trim()} style={{ background: form.name.trim() ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>
              {editId ? "保存" : "添加"}
            </button>
            <button className="kb-focus" onClick={() => { setMode("list"); setEditId(null) }} style={{ background: "transparent", color: C.muted, border: "none", padding: "9px 8px", fontSize: 14, cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
          <input className="kb-focus w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="用名字或号码搜索" style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        {cohorts.length > 0 && (
          <select className="kb-focus" value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} style={{ background: cohortFilter ? C.accentSoft : C.surface, color: cohortFilter ? C.accent : C.inkSoft, border: `1px solid ${cohortFilter ? "#CDE6E4" : C.line}`, borderRadius: 9, padding: "9px 10px", fontSize: 13.5, cursor: "pointer" }}>
            <option value="">全部期数</option>
            {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {people.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ padding: "60px 20px", maxWidth: 420, margin: "0 auto" }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Contact size={24} style={{ color: C.accent }} strokeWidth={1.6} />
          </div>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>名录还是空的。{canEdit ? "点「导入」粘贴一份名字 + 号码的名单,或「新增」一个个添加。" : "请管理人导入学员名单。"}</p>
        </div>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: 13.5, color: C.faint, padding: "20px 4px" }}>没有匹配「{q}」的成员。</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((p) => (
            <div key={p.id} className="flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "11px 14px" }}>
              <Avatar name={p.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{p.name}</span>
                  <RoleBadge role={p.role} small />
                  {p.cohort && <CohortChip cohort={p.cohort} />}
                </div>
                <div className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: C.muted, fontFamily: mono, marginTop: 2 }}>
                  {p.phone ? <><Phone size={11} /> {p.phone}</> : <span style={{ color: C.faint }}>无号码</span>}
                </div>
              </div>
              {canEdit && (
                <>
                  <button className="kb-focus" onClick={() => startEdit(p)} aria-label="编辑" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6 }}><Pencil size={15} /></button>
                  <button className="kb-focus" onClick={() => setConfirm(p)} aria-label="删除" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6 }}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(27,42,74,0.35)", zIndex: 50, padding: 20 }} onClick={() => setConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 24, maxWidth: 360, width: "100%", boxShadow: "0 20px 50px rgba(27,42,74,0.2)" }}>
            <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, marginBottom: 8 }}>从名录移除 {confirm.name}?</div>
            <div style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.6, marginBottom: 20 }}>已记录在课题里的发问和回答不受影响,只是从名录和选择列表里移除。</div>
            <div className="flex justify-end gap-3">
              <button className="kb-focus" onClick={() => setConfirm(null)} style={{ background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button className="kb-focus" onClick={() => { onDelete(confirm.id); setConfirm(null) }} style={{ background: C.danger, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>移除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- user management (admin only) ----------------------------------
function UsersView({ selfEmail }: { selfEmail: string | null }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<"list" | "add">("list")
  const [form, setForm] = useState<{ email: string; password: string; role: MemberRole }>({ email: "", password: "", role: "student" })
  const [confirmDel, setConfirmDel] = useState<AppUser | null>(null)
  const [pwFor, setPwFor] = useState<AppUser | null>(null)
  const [pw, setPw] = useState("")

  const inputStyle: React.CSSProperties = { width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: C.ink }

  const load = useCallback(async () => {
    try { setUsers(await listUsers()) } catch (e) { alert("加载用户失败:" + errText(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn(); await load() } catch (e) { alert(errText(e)) } finally { setBusy(false) }
  }

  const submitAdd = () => run(async () => {
    await createUser(form.email, form.password, form.role)
    setForm({ email: "", password: "", role: "student" })
    setMode("list")
  })
  const submitPw = () => run(async () => {
    if (pwFor) await resetUserPassword(pwFor.id, pw)
    setPwFor(null); setPw("")
  })

  const fmtDate = (t: number | null) => (t ? new Date(t).toLocaleDateString("zh-CN") : "—")

  if (loading) return <p style={{ fontSize: 14, color: C.muted, padding: "20px 4px" }}>正在加载用户…</p>

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
        <div className="flex items-baseline gap-2">
          <h1 style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>用户管理</h1>
          <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{users.length} 个账号</span>
        </div>
        <button className="kb-focus" onClick={() => setMode(mode === "add" ? "list" : "add")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 13.5, cursor: "pointer" }}>
          <Plus size={15} /> 新增用户
        </button>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
        这里管理的是<b>登录账号</b>(谁能进这个网站):管理人可增删改内容,学员账号登录后只能浏览。「学员名录」是通讯录,和登录账号是两回事。
      </p>

      {mode === "add" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12 }}>新增登录账号</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input className="kb-focus" style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="邮箱,例如 student@gmail.com" />
            <input className="kb-focus" style={inputStyle} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="初始密码(至少 6 位)" />
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            {([["student", "学员(只读)"], ["admin", "管理人(可编辑)"]] as const).map(([v, l]) => (
              <button key={v} className="kb-focus" onClick={() => setForm({ ...form, role: v })} style={{ background: form.role === v ? C.ink : "transparent", color: form.role === v ? "#fff" : C.inkSoft, border: form.role === v ? "none" : `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="kb-focus" onClick={submitAdd} disabled={busy || !form.email.trim() || form.password.length < 6} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: !busy && form.email.trim() && form.password.length >= 6 ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: !busy && form.email.trim() && form.password.length >= 6 ? "pointer" : "not-allowed" }}>
              {busy && <Loader2 size={14} className="kb-spin" />} 创建账号
            </button>
            <button className="kb-focus" onClick={() => setMode("list")} style={{ background: "transparent", color: C.muted, border: "none", padding: "9px 8px", fontSize: 14, cursor: "pointer" }}>取消</button>
            <span style={{ fontSize: 12.5, color: C.faint }}>创建后把邮箱和密码发给对方即可登录。</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {users.map((u) => {
          const isSelf = !!selfEmail && u.email.toLowerCase() === selfEmail.toLowerCase()
          return (
            <div key={u.id} className="flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 11, padding: "11px 14px", flexWrap: "wrap" }}>
              <Avatar name={u.email} size={36} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, fontFamily: mono }}>{u.email}</span>
                  {u.role === "admin"
                    ? <RoleBadge role="admin" small />
                    : <span style={{ background: C.lineSoft, color: C.muted, fontSize: 10, fontWeight: 600, padding: "0 5px", borderRadius: 5, lineHeight: 1.8 }}>学员 · 只读</span>}
                  {isSelf && <span style={{ fontSize: 11, color: C.accent }}>(我)</span>}
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                  创建 {fmtDate(u.createdAt)} · 最近登录 {fmtDate(u.lastSignInAt)}
                </div>
              </div>
              <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                <button className="kb-focus" disabled={busy || (isSelf && u.role === "admin")} onClick={() => run(() => updateUserRole(u.id, u.role === "admin" ? "student" : "admin"))}
                  title={isSelf && u.role === "admin" ? "不能把自己降为学员" : u.role === "admin" ? "改为学员(只读)" : "设为管理人"}
                  style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, color: isSelf && u.role === "admin" ? C.faint : C.inkSoft, cursor: isSelf && u.role === "admin" ? "not-allowed" : "pointer", padding: "6px 10px", fontSize: 12.5 }}>
                  {u.role === "admin" ? "改为学员" : "设为管理人"}
                </button>
                <button className="kb-focus" disabled={busy} onClick={() => { setPwFor(u); setPw("") }} aria-label="重置密码" title="重置密码"
                  style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6 }}><KeyRound size={15} /></button>
                <button className="kb-focus" disabled={busy || isSelf} onClick={() => setConfirmDel(u)} aria-label="删除账号" title={isSelf ? "不能删除自己" : "删除账号"}
                  style={{ background: "transparent", border: "none", color: isSelf ? C.lineSoft : C.faint, cursor: isSelf ? "not-allowed" : "pointer", padding: 6 }}><Trash2 size={15} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {pwFor && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(27,42,74,0.35)", zIndex: 50, padding: 20 }} onClick={() => setPwFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(27,42,74,0.2)" }}>
            <div style={{ fontFamily: serif, fontSize: 17, marginBottom: 8 }}>重置 {pwFor.email} 的密码</div>
            <input className="kb-focus" style={{ ...inputStyle, marginBottom: 16 }} type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密码(至少 6 位)" autoFocus />
            <div className="flex justify-end gap-3">
              <button className="kb-focus" onClick={() => setPwFor(null)} style={{ background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button className="kb-focus" onClick={submitPw} disabled={busy || pw.length < 6} style={{ background: pw.length >= 6 ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: pw.length >= 6 ? "pointer" : "not-allowed" }}>确认重置</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(27,42,74,0.35)", zIndex: 50, padding: 20 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(27,42,74,0.2)" }}>
            <div style={{ fontFamily: serif, fontSize: 17, marginBottom: 8 }}>删除账号 {confirmDel.email}?</div>
            <div style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.6, marginBottom: 20 }}>删除后 TA 将无法登录。课题和名录数据不受影响。</div>
            <div className="flex justify-end gap-3">
              <button className="kb-focus" onClick={() => setConfirmDel(null)} style={{ background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button className="kb-focus" onClick={() => { const u = confirmDel; setConfirmDel(null); run(() => deleteUser(u.id)) }} style={{ background: C.danger, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Supabase RPC 的 raise exception 信息在 error.message 里
function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/^.*?exception:?\s*/i, "")
}

// ---- people picker -------------------------------------------------
function PeoplePicker({ people, multi, value, onChange, placeholder }: {
  people: Person[]; multi?: boolean; value: string | string[]; onChange: (v: string | string[]) => void; placeholder?: string
}) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const selected = multi ? ((value as string[]) || []) : value ? [value as string] : []
  const ql = q.trim().toLowerCase()
  const pool = people.filter((p) => !selected.includes(p.name))
  const matches = (ql ? pool.filter((p) => p.name.toLowerCase().includes(ql) || (!!digits(q) && digits(p.phone).includes(digits(q)))) : pool).slice(0, 8)
  const exact = people.some((p) => p.name === q.trim()) || selected.includes(q.trim())

  const add = (name: string) => {
    const n = (name || "").trim()
    if (!n) return
    if (multi) { if (!selected.includes(n)) onChange([...selected, n]) }
    else onChange(n)
    setQ(""); if (!multi) setOpen(false)
  }
  const remove = (name: string) => (multi ? onChange(selected.filter((s) => s !== name)) : onChange(""))

  const chipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 18, padding: "3px 4px 3px 4px" }
  const showInput = multi || selected.length === 0

  return (
    <div style={{ position: "relative" }}>
      <div className="flex items-center" style={{ flexWrap: "wrap", gap: 6, minHeight: 42, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "5px 8px" }}>
        {selected.map((name) => (
          <span key={name} style={chipStyle}>
            <Avatar name={name} size={22} />
            <span style={{ fontSize: 13.5, color: C.ink }}>{name}</span>
            <RoleBadge role={findRole(people, name)} small />
            <button className="kb-focus" onClick={() => remove(name)} aria-label="移除" style={{ display: "flex", background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: "0 4px 0 0" }}>
              <X size={13} />
            </button>
          </span>
        ))}
        {showInput && (
          <input className="kb-focus" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q) } }} placeholder={selected.length === 0 ? placeholder : "继续添加…"}
            style={{ flex: 1, minWidth: 120, border: "none", outline: "none", background: "transparent", fontSize: 14, color: C.ink, padding: "4px 2px" }} />
        )}
      </div>
      {open && showInput && (matches.length > 0 || (q.trim() && !exact)) && (
        <div className="kb-scroll" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 12px 30px rgba(27,42,74,0.14)", zIndex: 40, maxHeight: 260, overflowY: "auto", padding: 5 }}>
          {matches.map((p) => (
            <button key={p.id || p.name} className="kb-focus w-full" onMouseDown={(e) => e.preventDefault()} onClick={() => add(p.name)}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 7, padding: "7px 8px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Avatar name={p.name} size={26} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: C.ink }}>{p.name}</span>
                {p.phone && <span style={{ fontSize: 12, color: C.faint, marginLeft: 8, fontFamily: mono }}>{p.phone}</span>}
                {p.cohort && <span style={{ fontSize: 11.5, color: C.faint, marginLeft: 8 }}>· {p.cohort}</span>}
              </span>
              <RoleBadge role={p.role} small />
            </button>
          ))}
          {q.trim() && !exact && (
            <button className="kb-focus w-full" onMouseDown={(e) => e.preventDefault()} onClick={() => add(q)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: matches.length ? `1px solid ${C.lineSoft}` : "none", borderRadius: 7, padding: "8px", cursor: "pointer", color: C.accent, fontSize: 13.5 }}>
              <Plus size={14} /> 添加「{q.trim()}」(不在名录中)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
