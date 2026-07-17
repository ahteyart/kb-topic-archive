// WhatsApp「导出聊天记录」(.txt) 解析器 — 纯函数,无依赖
import { digits } from "./tokens"
import type { Person } from "./store"

export type WaMsg = {
  date: string // 导出里的原始日期字符串(如 12/05/2024)
  time: string
  speaker: string // 原始发言人(联系人名或电话)
  text: string
}

// 日期 / 时间的通用片段(时间可含秒 / am·pm,大小写与点号皆可)
const DATE_TOK = /\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/
const TIME_TOK = /\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[apAP]\.?\s?[mM]\.?)?/
// iOS:[日期, 时间] 或 [时间, 日期](不同地区顺序不同)+ 发言人: 内容
const IOS_BRACKET_RE = /^[\s‎‏﻿]*\[([^\]]+)\]\s*([\s\S]*)$/
// Android:日期, 时间 - 发言人: 内容(分隔符 - 或 –)
const ANDROID_RE = new RegExp(
  `^[\\s\\u200e\\u200f\\ufeff]*(${DATE_TOK.source}),?\\s+(${TIME_TOK.source})\\s*[-–]\\s([\\s\\S]*)$`
)

// 媒体占位(语音/图片/文件暂不转写)
const MEDIA_RE =
  /<Media omitted>|<媒体已省略>|<媒体文件已省略>|\(file attached\)|(?:image|video|audio|sticker|GIF|document) omitted|已省略(?:图片|视频|音频|贴图|文档)/i

const clean = (s: string) => s.replace(/[​-‏‪-‮﻿]/g, "").trim()

// 从一行里解析出「日期 / 时间 / 剩余(发言人: 内容)」,认不出返回 null
function parseHeader(line: string): { date: string; time: string; rest: string } | null {
  const b = IOS_BRACKET_RE.exec(line)
  if (b) {
    const dm = DATE_TOK.exec(b[1])
    if (!dm) return null // 方括号里必须有个日期才算消息头
    const tm = TIME_TOK.exec(b[1])
    return { date: dm[0], time: tm ? tm[0] : "", rest: b[2] }
  }
  const a = ANDROID_RE.exec(line)
  if (a) return { date: a[1], time: a[2], rest: a[3] }
  return null
}

export function parseWaExport(raw: string): WaMsg[] {
  const lines = raw.split(/\r?\n/)
  const out: WaMsg[] = []

  for (const line of lines) {
    const h = parseHeader(line)
    if (h) {
      // 「发言人: 内容」;没有冒号的是系统消息(入群/改群名等),丢弃
      const sp = /^(.+?)[:：]\s?([\s\S]*)$/.exec(clean(h.rest))
      if (!sp) continue
      const speaker = clean(sp[1])
      let text = clean(sp[2])
      if (MEDIA_RE.test(text)) text = "[媒体]"
      out.push({ date: h.date, time: h.time, speaker, text })
    } else if (out.length && clean(line)) {
      // 无时间戳的行:多行消息的后续行,并入上一条
      out[out.length - 1].text += "\n" + clean(line)
    }
  }
  return out.filter((m) => m.text)
}

// 发言人 → 名录成员名。导出里非联系人显示为电话(+60 12-345 6789)。
export function matchSpeaker(rawName: string, people: Person[]): string {
  const name = clean(rawName)
  const d = digits(name)
  if (d.length >= 7) {
    // 电话:与名录号码做尾号匹配(至少 7 位,忽略国码差异)
    const hit = people.find((p) => {
      const pd = digits(p.phone)
      if (pd.length < 7) return false
      const n = Math.min(pd.length, d.length, 9)
      return pd.slice(-n) === d.slice(-n)
    })
    if (hit) return hit.name
    return name
  }
  const lower = name.toLowerCase()
  const exact = people.find((p) => p.name.toLowerCase() === lower)
  if (exact) return exact.name
  const partial = people.find(
    (p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
  )
  return partial ? partial.name : name
}

// 出现过的日期(按出现顺序去重),供日期范围下拉
export function waDates(msgs: WaMsg[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of msgs) {
    if (!seen.has(m.date)) {
      seen.add(m.date)
      out.push(m.date)
    }
  }
  return out
}

// 按日期范围(出现顺序的闭区间)筛选
export function filterByDateRange(msgs: WaMsg[], dates: string[], from: string, to: string): WaMsg[] {
  const fi = dates.indexOf(from)
  const ti = dates.indexOf(to)
  if (fi === -1 || ti === -1) return msgs
  const lo = Math.min(fi, ti)
  const hi = Math.max(fi, ti)
  const ok = new Set(dates.slice(lo, hi + 1))
  return msgs.filter((m) => ok.has(m.date))
}
