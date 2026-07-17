"use client"

// Data layer: maps the normalized Supabase schema <-> the prototype's
// name-based shapes, so the ported UI code can stay almost identical.
import { createClient } from "@/lib/supabase/client"
import { digits } from "@/lib/tokens"
import type { MemberRole, TopicStatus } from "@/lib/database.types"

export type Person = {
  id: string
  name: string
  phone: string
  role: MemberRole
  cohort: string // cohort name ("" if none)
}

export type Message = {
  id: string
  speaker: string // member name or free-typed name ("" if unsigned)
  text: string
}

export type Topic = {
  id: string
  code: string
  title: string
  category: string
  cohort: string
  status: TopicStatus
  discussion: string
  conclusion: string
  tags: string[]
  asker: string
  contributors: string[]
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export type TopicDraft = {
  id: string | null
  title: string
  category: string
  cohort: string
  status: TopicStatus
  discussion: string
  conclusion: string
  tags: string // comma-separated in the editor
  asker: string
  contributors: string[]
  messages: Message[]
}

const ms = (s?: string | null) => (s ? new Date(s).getTime() : 0)

// ---- loading -------------------------------------------------------
export async function loadTopics(): Promise<Topic[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("topics")
    .select(
      `id, code, title, category, status, discussion, conclusion, tags, created_at, updated_at,
       cohort:cohorts(name),
       asker:members!topics_asker_id_fkey(name),
       contributors:topic_contributors(member:members(name)),
       messages:discussion_messages(id, body, position, speaker_name, speaker:members(name))`
    )
    .order("updated_at", { ascending: false })
  if (error) throw error

  return (data ?? []).map((t): Topic => {
    // supabase types embedded to-one relations as arrays in some versions
    const cohort = pickOne(t.cohort)?.name ?? ""
    const asker = pickOne(t.asker)?.name ?? ""
    const contributors = (t.contributors ?? [])
      .map((c) => pickOne(c.member)?.name)
      .filter((n): n is string => !!n)
    const messages = (t.messages ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((m) => ({
        id: m.id,
        speaker: pickOne(m.speaker)?.name ?? m.speaker_name ?? "",
        text: m.body,
      }))
    return {
      id: t.id,
      code: t.code,
      title: t.title,
      category: t.category ?? "",
      cohort,
      status: t.status,
      discussion: t.discussion ?? "",
      conclusion: t.conclusion ?? "",
      tags: t.tags ?? [],
      asker,
      contributors,
      messages,
      createdAt: ms(t.created_at),
      updatedAt: ms(t.updated_at),
    }
  })
}

export async function loadPeople(): Promise<Person[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("members")
    .select(`id, name, phone, role, cohort:cohorts(name)`)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone ?? "",
    role: m.role,
    cohort: pickOne(m.cohort)?.name ?? "",
  }))
}

// ---- cohort + member resolution (create-on-the-fly) ----------------
async function resolveCohortId(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const supabase = createClient()
  const { data: found } = await supabase
    .from("cohorts")
    .select("id")
    .eq("name", trimmed)
    .maybeSingle()
  if (found) return found.id
  const { data: created, error } = await supabase
    .from("cohorts")
    .insert({ name: trimmed })
    .select("id")
    .single()
  if (error) throw error
  return created.id
}

// Resolve a set of member names to ids, creating any that don't exist yet
// (this mirrors the prototype letting you free-type a participant name).
async function resolveMemberIds(names: string[]): Promise<Map<string, string>> {
  const supabase = createClient()
  const map = new Map<string, string>()
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (wanted.length === 0) return map

  const { data: existing } = await supabase
    .from("members")
    .select("id, name")
    .in("name", wanted)
  existing?.forEach((m) => map.set(m.name, m.id))

  const missing = wanted.filter((n) => !map.has(n))
  if (missing.length) {
    const { data: created, error } = await supabase
      .from("members")
      .insert(missing.map((name) => ({ name })))
      .select("id, name")
    if (error) throw error
    created?.forEach((m) => map.set(m.name, m.id))
  }
  return map
}

// ---- topic mutations -----------------------------------------------
export async function saveTopic(draft: TopicDraft): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tags = draft.tags.split(",").map((s) => s.trim()).filter(Boolean)
  const asker = draft.asker.trim()
  const messages = draft.messages
    .map((m) => ({ speaker: m.speaker.trim(), text: m.text.trim() }))
    .filter((m) => m.speaker || m.text)

  // rule: everyone who spoke in the discussion is auto-added as a contributor
  const pickedContributors = draft.contributors.map((s) => s.trim()).filter(Boolean)
  const contributorNames = [
    ...new Set([
      ...pickedContributors,
      ...messages.map((m) => m.speaker).filter((n) => n && n !== asker),
    ]),
  ]

  // resolve every referenced name (asker + contributors + speakers) to member ids
  const allNames = [asker, ...contributorNames, ...messages.map((m) => m.speaker)]
  const idMap = await resolveMemberIds(allNames.filter(Boolean))
  const cohortId = await resolveCohortId(draft.cohort)
  const askerId = asker ? idMap.get(asker) ?? null : null

  const row = {
    title: draft.title.trim(),
    category: draft.category.trim() || null,
    cohort_id: cohortId,
    status: draft.status,
    discussion: draft.discussion.trim() || null,
    conclusion: draft.conclusion.trim() || null,
    tags,
    asker_id: askerId,
  }

  let topicId = draft.id
  if (topicId) {
    const { error } = await supabase.from("topics").update(row).eq("id", topicId)
    if (error) throw error
    // replace children
    await supabase.from("topic_contributors").delete().eq("topic_id", topicId)
    await supabase.from("discussion_messages").delete().eq("topic_id", topicId)
  } else {
    const { data, error } = await supabase
      .from("topics")
      .insert({ ...row, created_by: user?.id ?? null })
      .select("id")
      .single()
    if (error) throw error
    topicId = data.id
  }

  // contributors (deduped ids, excluding asker)
  const contribIds = [
    ...new Set(
      contributorNames
        .map((n) => idMap.get(n))
        .filter((id): id is string => !!id && id !== askerId)
    ),
  ]
  if (contribIds.length) {
    const { error } = await supabase
      .from("topic_contributors")
      .insert(contribIds.map((member_id) => ({ topic_id: topicId!, member_id })))
    if (error) throw error
  }

  // discussion messages (ordered)
  if (messages.length) {
    const { error } = await supabase.from("discussion_messages").insert(
      messages.map((m, i) => ({
        topic_id: topicId!,
        speaker_id: m.speaker ? idMap.get(m.speaker) ?? null : null,
        speaker_name: m.speaker || null,
        body: m.text,
        position: i,
      }))
    )
    if (error) throw error
  }

  return topicId!
}

export async function deleteTopic(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("topics").delete().eq("id", id)
  if (error) throw error
}

// ---- member mutations ----------------------------------------------
export async function addMember(p: {
  name: string
  phone?: string
  role?: MemberRole
  cohort?: string
}): Promise<void> {
  const supabase = createClient()
  const cohortId = await resolveCohortId(p.cohort ?? "")
  const { error } = await supabase.from("members").insert({
    name: p.name.trim(),
    phone: (p.phone ?? "").trim() || null,
    role: p.role ?? "student",
    cohort_id: cohortId,
  })
  if (error) throw error
}

export async function updateMember(
  id: string,
  patch: { name: string; phone: string; role: MemberRole; cohort: string }
): Promise<void> {
  const supabase = createClient()
  const cohortId = await resolveCohortId(patch.cohort)
  const { error } = await supabase
    .from("members")
    .update({
      name: patch.name.trim(),
      phone: patch.phone.trim() || null,
      role: patch.role,
      cohort_id: cohortId,
    })
    .eq("id", id)
  if (error) throw error
}

export async function deleteMember(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("members").delete().eq("id", id)
  if (error) throw error
}

// Bulk import: dedupe against existing by phone (or name), merge fields.
export async function importMembers(
  list: { name: string; phone: string; role: MemberRole; cohort: string }[],
  existing: Person[]
): Promise<void> {
  const supabase = createClient()
  const byKey = new Map(existing.map((p) => [digits(p.phone) || p.name, p]))

  for (const p of list) {
    const key = digits(p.phone) || p.name
    const cohortId = await resolveCohortId(p.cohort)
    const ex = byKey.get(key)
    if (ex) {
      await supabase
        .from("members")
        .update({
          phone: p.phone.trim() || ex.phone || null,
          role: p.role || ex.role,
          ...(cohortId ? { cohort_id: cohortId } : {}),
        })
        .eq("id", ex.id)
    } else {
      await supabase.from("members").insert({
        name: p.name.trim(),
        phone: p.phone.trim() || null,
        role: p.role || "student",
        cohort_id: cohortId,
      })
    }
  }
}

// supabase-js sometimes types an embedded to-one relation as T | T[]
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}
