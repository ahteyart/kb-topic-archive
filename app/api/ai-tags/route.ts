import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"

type Body = {
  title?: string
  discussion?: string
  conclusion?: string
  category?: string
}

const buildPrompt = (b: Body) => {
  const record = `标题:${b.title || ""}\n分类:${b.category || "未定"}\n讨论过程:${
    b.discussion || "(无)"
  }\n老师结论:${b.conclusion || "(无)"}`
  return (
    "你是一个课题知识库的标签助手。下面是一条课题记录(老师和学生的讨论及结论)。" +
    "请提炼 3 到 6 个简短、具体的中文标签,方便日后搜索。标签应聚焦工具名、主题、场景或行业," +
    "避免空泛词(如「讨论」「问题」「方法」)。工具或产品名保留原文(如 ChatGPT、n8n、Supabase)。" +
    "如果原本没有分类,请顺便给一个合适的分类建议。\n\n" +
    "只返回一个 JSON 对象,不要任何多余文字、解释或 markdown 代码块:\n" +
    '{"tags": ["标签1", "标签2"], "category": "建议分类"}\n\n' +
    "课题记录:\n" +
    record
  )
}

function parseResult(text: string): { tags: string[]; category: string | null } {
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim()
  const match = clean.match(/\{[\s\S]*\}/)
  const obj = JSON.parse(match ? match[0] : clean)
  return {
    tags: Array.isArray(obj.tags)
      ? obj.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [],
    category: obj.category ? String(obj.category).trim() : null,
  }
}

async function viaDeepSeek(prompt: string, key: string) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    }),
  })
  if (!res.ok) throw new Error(`deepseek ${res.status}`)
  const data = await res.json()
  return parseResult(data.choices?.[0]?.message?.content ?? "")
}

async function viaClaude(prompt: string, key: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`claude ${res.status}`)
  const data = await res.json()
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
  return parseResult(text)
}

export async function POST(req: Request) {
  // only signed-in admins can spend AI credits
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

  const prompt = buildPrompt(body)
  const deepseek = process.env.DEEPSEEK_API_KEY
  const anthropic = process.env.ANTHROPIC_API_KEY

  try {
    if (deepseek) return NextResponse.json(await viaDeepSeek(prompt, deepseek))
    if (anthropic) return NextResponse.json(await viaClaude(prompt, anthropic))
    // no key configured -> signal the client to use its local fallback
    return NextResponse.json({ tags: [], category: null, fallback: true })
  } catch (e) {
    return NextResponse.json(
      { tags: [], category: null, error: String(e) },
      { status: 200 } // soft-fail: client falls back to local keyword extraction
    )
  }
}
