import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"

type InMsg = { speaker: string; text: string }
type Body = { messages?: InMsg[]; memberNames?: string[] }

export type SegmentDraft = {
  title: string
  category: string | null
  tags: string[]
  asker: string | null
  conclusion: string | null
  indexes: number[]
}

const MAX_MESSAGES = 220

function buildPrompt(messages: InMsg[], memberNames: string[]) {
  const list = messages
    .map((m, i) => `#${i} ${m.speaker}: ${m.text.replace(/\n/g, " / ")}`)
    .join("\n")
  return (
    "你是一个课题知识库的整理助手。下面是一段 WhatsApp 群聊记录(AI 教育陪跑课程,老师和学员讨论)。" +
    "请把它切分成一条或多条独立的「课题」。一条课题 = 一个学员提出的问题 + 围绕它的讨论 + (若有)老师给出的结论。\n" +
    "要求:\n" +
    "1. 闲聊、打招呼、通知、与学习无关的消息直接忽略,不要塞进任何课题。\n" +
    "2. 每条课题给:title(15-40字,概括讨论的问题)、category(建议分类,如 AI工具应用/自动化/营销)、" +
    "tags(2-5个具体中文标签,工具名保留原文)、asker(发问人名字,从消息里判断)、" +
    "conclusion(如果老师给了明确答案,用原意概括;没有就 null)、indexes(属于这条课题的消息编号数组,按顺序)。\n" +
    "3. indexes 只能用下面列表里出现的编号,不要编造。一个编号最多属于一条课题。\n" +
    "4. 如果整段都是闲聊,返回空数组。\n" +
    (memberNames.length ? `名录里的成员名字(asker 尽量用这里的写法):${memberNames.join("、")}\n` : "") +
    '\n只返回 JSON 数组,不要任何解释或 markdown 代码块:\n' +
    '[{"title":"…","category":"…","tags":["…"],"asker":"…","conclusion":"…或null","indexes":[0,1,2]}]\n\n' +
    "聊天记录:\n" +
    list
  )
}

function parseResult(text: string, max: number): SegmentDraft[] {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
  const m = cleaned.match(/\[[\s\S]*\]/)
  const arr = JSON.parse(m ? m[0] : cleaned)
  if (!Array.isArray(arr)) return []
  return arr
    .map((d): SegmentDraft => ({
      title: String(d?.title ?? "").trim(),
      category: d?.category ? String(d.category).trim() : null,
      tags: Array.isArray(d?.tags) ? d.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
      asker: d?.asker ? String(d.asker).trim() : null,
      conclusion: d?.conclusion && String(d.conclusion).trim() !== "null" ? String(d.conclusion).trim() : null,
      indexes: Array.isArray(d?.indexes)
        ? [...new Set(d.indexes.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0 && n < max))] as number[]
        : [],
    }))
    .filter((d) => d.title && d.indexes.length)
}

async function viaDeepSeek(prompt: string, key: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`deepseek ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ""
}

async function viaClaude(prompt: string, key: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`claude ${res.status}`)
  const data = await res.json()
  return (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  const messages = (body.messages ?? []).slice(0, MAX_MESSAGES)
  if (!messages.length) {
    return NextResponse.json({ drafts: [] })
  }

  const prompt = buildPrompt(messages, body.memberNames ?? [])
  const deepseek = process.env.DEEPSEEK_API_KEY
  const anthropic = process.env.ANTHROPIC_API_KEY
  if (!deepseek && !anthropic) {
    return NextResponse.json({ drafts: [], error: "未配置 AI key(DEEPSEEK_API_KEY)" }, { status: 200 })
  }

  try {
    const text = deepseek ? await viaDeepSeek(prompt, deepseek) : await viaClaude(prompt, anthropic!)
    return NextResponse.json({ drafts: parseResult(text, messages.length) })
  } catch (e) {
    return NextResponse.json({ drafts: [], error: String(e) }, { status: 200 })
  }
}
