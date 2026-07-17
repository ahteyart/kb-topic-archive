import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, ArrowLeft, Pencil, Trash2, X, BookOpen,
  ChevronRight, Menu, CheckCircle2, MessageCircle, Clock, Tag,
  Sparkles, Loader2, Users, HelpCircle, Contact, Upload, Phone,
} from "lucide-react";

// ---- design tokens -------------------------------------------------
const C = {
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
};
const serif = 'Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif';
const sans = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const CAT_COLORS = ["#0E7C7B", "#3B5BA5", "#B4884D", "#8E5572", "#5B8266", "#C1662F", "#4A6FA5", "#7A6B9E"];
const catColor = (name) => {
  if (!name) return C.muted;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
};

const STATUS = {
  "已结论": { fg: "#0E7C7B", bg: "#E6F2F1", icon: CheckCircle2 },
  "讨论中": { fg: "#B4884D", bg: "#F5EEE0", icon: MessageCircle },
  "待跟进": { fg: "#6B7488", bg: "#EEF0F4", icon: Clock },
};

const KEY = "kb-topics-v1";
const PKEY = "kb-people-v1";

const SEED = [
  {
    id: "seed1", code: "No.001",
    title: "如何用 ChatGPT 帮 SME 写出第一篇能用的营销文案",
    category: "AI工具应用", cohort: "第1期",
    tags: ["文案", "ChatGPT", "营销"],
    discussion: "学员普遍反映:让 AI 写文案,出来的东西很空、很像广告口号,不像自己的生意。追问后发现,大家给的指令都是「帮我写一篇卖椰浆饭的文案」这种一句话。",
    conclusion: "给 AI 下指令前,先讲清楚三件事:你是谁(什么店、什么特色)、卖给谁(什么样的客人)、想要对方做什么(到店 / 加 WhatsApp / 下单)。再给它一个具体角色(「你是一位在地美食博主」)和一两个你喜欢的例子,输出质量会立刻不一样。",
    asker: "陈美玲", contributors: ["林伟强", "黄晓芳", "郑老师"],
    messages: [
      { id: "m1", speaker: "陈美玲", text: "我让 ChatGPT 帮我写椰浆饭的文案,可是写出来很像大品牌广告,不像我的小店。" },
      { id: "m2", speaker: "郑老师", text: "你给它的指令太短了,它不知道你的店有什么特色、客人是谁。" },
      { id: "m3", speaker: "林伟强", text: "所以要先给它背景对吗?我上次加了「我是夜市摊」效果就好一点。" },
      { id: "m4", speaker: "郑老师", text: "对,再加一个角色和一两个例子会更好。" },
    ],
    status: "已结论", createdAt: 0, updatedAt: 0,
  },
  {
    id: "seed2", code: "No.002",
    title: "n8n 自动化,新手从哪一个流程开始最容易上手",
    category: "自动化", cohort: "第1期",
    tags: ["n8n", "自动化", "入门"],
    discussion: "多数学员一打开 n8n 就卡在触发器和凭证(credentials)配置,试着一次做完整个流程,结果哪个节点报错都不知道。",
    conclusion: "从「定时抓一个网页 → 整理成一句话 → 发到 Telegram」这种单线三节点流程练起。先把一条最短的路跑通、看到消息真的发出来,再往上加判断和分支。不要一开始就搭复杂流程。",
    asker: "林伟强", contributors: ["陈美玲", "郑老师"],
    messages: [
      { id: "m5", speaker: "林伟强", text: "n8n 我一开就卡在 credentials,不知道从哪个流程开始练。" },
      { id: "m6", speaker: "郑老师", text: "先做最简单的:定时抓一个网页,发去 Telegram。跑通一条,再加东西。" },
      { id: "m7", speaker: "陈美玲", text: "明白,先求跑通不求复杂。" },
    ],
    status: "已结论", createdAt: 0, updatedAt: 0,
  },
];

const SEED_PEOPLE = [
  { id: "p1", name: "陈美玲", phone: "012-3456789", role: "student", cohort: "第1期" },
  { id: "p2", name: "林伟强", phone: "016-2233445", role: "student", cohort: "第1期" },
  { id: "p3", name: "黄晓芳", phone: "017-8899001", role: "student", cohort: "第2期" },
  { id: "p4", name: "郑老师", phone: "019-7778888", role: "admin", cohort: "" },
];

// ---- helpers -------------------------------------------------------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const digits = (s) => (s || "").replace(/\D/g, "");
const findRole = (people, name) => { const p = people.find((x) => x.name === name); return p ? p.role : null; };
const findPhone = (people, name) => { const p = people.find((x) => x.name === name); return p ? p.phone : ""; };
const findCohort = (people, name) => { const p = people.find((x) => x.name === name); return p ? (p.cohort || "") : ""; };
const ROLE_RE = /管理|admin|老师|讲师|导师|助教|teacher|staff|工作人员/i;
const parsePeople = (text) => text.split(/\n+/).map((line) => {
  const parts = line.split(/[,，\t;；]+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length || !parts[0]) return null;
  let role = "student", cohort = "";
  parts.slice(2).forEach((tok) => { if (ROLE_RE.test(tok)) role = "admin"; else if (!cohort) cohort = tok; });
  return { name: parts[0], phone: parts[1] || "", role, cohort };
}).filter(Boolean);
const nextCode = (arr) => {
  const max = arr.reduce((m, t) => Math.max(m, parseInt((t.code || "").replace(/\D/g, "")) || 0), 0);
  return "No." + String(max + 1).padStart(3, "0");
};

async function storeGet(key) {
  if (typeof window === "undefined" || !window.storage) return null;
  try { const r = await window.storage.get(key); return r?.value ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function storeSet(key, val) {
  if (typeof window === "undefined" || !window.storage) return;
  try { await window.storage.set(key, JSON.stringify(val)); }
  catch (e) { console.error("storage.set failed", e); }
}

// AI auto-tagging via Claude ----------------------------------------
async function generateTags({ title, discussion, conclusion, category }) {
  const record = `标题:${title}\n分类:${category || "未定"}\n讨论过程:${discussion || "(无)"}\n老师结论:${conclusion || "(无)"}`;
  const prompt =
    "你是一个课题知识库的标签助手。下面是一条课题记录(老师和学生的讨论及结论)。" +
    "请提炼 3 到 6 个简短、具体的中文标签,方便日后搜索。标签应聚焦工具名、主题、场景或行业," +
    "避免空泛词(如「讨论」「问题」「方法」)。工具或产品名保留原文(如 ChatGPT、n8n、Supabase)。" +
    "如果原本没有分类,请顺便给一个合适的分类建议。\n\n" +
    "只返回一个 JSON 对象,不要任何多余文字、解释或 markdown 代码块:\n" +
    '{"tags": ["标签1", "标签2"], "category": "建议分类"}\n\n' +
    "课题记录:\n" + record;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

// offline fallback: pull English tool/product names + key terms
function localTags({ title, discussion, conclusion }) {
  const text = [title, discussion, conclusion].join(" ");
  const eng = [...new Set((text.match(/[A-Za-z][A-Za-z0-9.\-]+/g) || []))].filter((w) => w.length > 1);
  return eng.slice(0, 5);
}

// ---- small UI atoms ------------------------------------------------
function StatusPill({ status }) {
  const s = STATUS[status] || STATUS["待跟进"];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full"
      style={{ background: s.bg, color: s.fg, fontFamily: sans, fontSize: 12, padding: "3px 9px", fontWeight: 500 }}>
      <Icon size={12} strokeWidth={2.4} /> {status}
    </span>
  );
}

function CatDot({ category }) {
  return <span className="rounded-full" style={{ width: 8, height: 8, background: catColor(category), display: "inline-block", flexShrink: 0 }} />;
}

const AVATAR_COLORS = ["#3B5BA5", "#0E7C7B", "#B4884D", "#8E5572", "#5B8266", "#C1662F", "#4A6FA5", "#7A6B9E", "#2F6F6B"];
const avatarColor = (name) => {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
function Avatar({ name, size = 30 }) {
  return (
    <span className="flex items-center justify-center rounded-full" style={{
      width: size, height: size, background: avatarColor(name), color: "#fff",
      fontSize: size * 0.42, fontWeight: 600, fontFamily: sans, flexShrink: 0, lineHeight: 1,
    }}>{(name || "?").trim().charAt(0)}</span>
  );
}

function RoleBadge({ role, small }) {
  if (role !== "admin") return null;
  return (
    <span style={{ background: C.brassSoft, color: C.brass, fontSize: small ? 10 : 10.5, fontWeight: 600, padding: small ? "0px 5px" : "1px 6px", borderRadius: 5, fontFamily: sans, lineHeight: 1.5, whiteSpace: "nowrap" }}>管理人</span>
  );
}

// searchable people picker (single or multi), searches name + phone,
// includes admins, and allows free-typed names not in the directory
function PeoplePicker({ people, multi, value, onChange, placeholder }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = multi ? (value || []) : (value ? [value] : []);
  const ql = q.trim().toLowerCase();
  const pool = people.filter((p) => !selected.includes(p.name));
  const matches = (ql
    ? pool.filter((p) => p.name.toLowerCase().includes(ql) || (digits(q) && digits(p.phone).includes(digits(q))))
    : pool
  ).slice(0, 8);
  const exact = people.some((p) => p.name === q.trim()) || selected.includes(q.trim());

  const add = (name) => {
    const n = (name || "").trim();
    if (!n) return;
    if (multi) { if (!selected.includes(n)) onChange([...selected, n]); }
    else onChange(n);
    setQ(""); if (!multi) setOpen(false);
  };
  const remove = (name) => multi ? onChange(selected.filter((s) => s !== name)) : onChange("");

  const chipStyle = { display: "inline-flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 18, padding: "3px 4px 3px 4px" };
  const showInput = multi || selected.length === 0;

  return (
    <div style={{ position: "relative" }}>
      <div className="flex items-center" style={{ flexWrap: "wrap", gap: 6, minHeight: 42, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "5px 8px" }}>
        {selected.map((name) => (
          <span key={name} style={chipStyle}>
            <Avatar name={name} size={22} />
            <span style={{ fontSize: 13.5, color: C.ink }}>{name}</span>
            <RoleBadge role={findRole(people, name)} small />
            <button className="kb-focus" onClick={() => remove(name)} aria-label="移除"
              style={{ display: "flex", background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: "0 4px 0 0" }}>
              <X size={13} />
            </button>
          </span>
        ))}
        {showInput && (
          <input className="kb-focus" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }}
            placeholder={selected.length === 0 ? placeholder : "继续添加…"}
            style={{ flex: 1, minWidth: 120, border: "none", outline: "none", background: "transparent", fontSize: 14, color: C.ink, padding: "4px 2px" }} />
        )}
      </div>
      {open && showInput && (matches.length > 0 || (q.trim() && !exact)) && (
        <div className="kb-scroll" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 12px 30px rgba(27,42,74,0.14)", zIndex: 40, maxHeight: 260, overflowY: "auto", padding: 5 }}>
          {matches.map((p) => (
            <button key={p.id || p.name} className="kb-focus w-full" onMouseDown={(e) => e.preventDefault()} onClick={() => add(p.name)}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 7, padding: "7px 8px", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
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
  );
}


// ---- main ----------------------------------------------------------
export default function KnowledgeBase() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | detail | edit | roster | student
  const [selectedId, setSelectedId] = useState(null);
  const [studentName, setStudentName] = useState(null);
  const [detailFrom, setDetailFrom] = useState("list");
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [rosterRole, setRosterRole] = useState("student"); // student | admin | all
  const [rosterCohort, setRosterCohort] = useState(null);

  useEffect(() => {
    (async () => {
      let loaded = await storeGet(KEY);
      if (!loaded || !Array.isArray(loaded)) { loaded = SEED; await storeSet(KEY, SEED); }
      setTopics(loaded);
      let ppl = await storeGet(PKEY);
      if (!ppl || !Array.isArray(ppl)) { ppl = SEED_PEOPLE; await storeSet(PKEY, SEED_PEOPLE); }
      setPeople(ppl);
      setLoading(false);
    })();
  }, []);

  const persist = (next) => { setTopics(next); storeSet(KEY, next); };
  const persistPeople = (next) => { setPeople(next); storeSet(PKEY, next); };

  const addPerson = (p) => persistPeople([...people, { id: uid(), name: p.name.trim(), phone: (p.phone || "").trim(), role: p.role || "student", cohort: (p.cohort || "").trim() }]);
  const updatePerson = (id, patch) => persistPeople(people.map((p) => p.id === id ? { ...p, ...patch } : p));
  const deletePerson = (id) => persistPeople(people.filter((p) => p.id !== id));
  const importPeople = (list) => {
    const byKey = new Map(people.map((p) => [digits(p.phone) || p.name, p]));
    list.forEach((p) => {
      const key = digits(p.phone) || p.name;
      if (byKey.has(key)) { const ex = byKey.get(key); ex.phone = p.phone || ex.phone; ex.role = p.role || ex.role; ex.cohort = p.cohort || ex.cohort; }
      else byKey.set(key, { id: uid(), ...p });
    });
    persistPeople([...byKey.values()]);
  };

  const categories = useMemo(() => {
    const m = new Map();
    topics.forEach((t) => m.set(t.category || "未分类", (m.get(t.category || "未分类") || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [topics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (catFilter && (t.category || "未分类") !== catFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [t.title, t.conclusion, t.discussion, t.code, t.cohort, (t.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [topics, search, catFilter, statusFilter]);

  const selected = topics.find((t) => t.id === selectedId);

  // student roster with engagement stats (seeded from the directory so
  // registered students with zero activity still show up as least active)
  const students = useMemo(() => {
    const m = new Map();
    const ensure = (n) => { if (!m.has(n)) m.set(n, { name: n, asked: [], answered: [], role: findRole(people, n) || "student", phone: findPhone(people, n), cohort: findCohort(people, n) }); return m.get(n); };
    people.forEach((p) => { const s = ensure(p.name); s.role = p.role; s.phone = p.phone; s.cohort = p.cohort || ""; });
    topics.forEach((t) => {
      if (t.asker && t.asker.trim()) ensure(t.asker.trim()).asked.push(t);
      (t.contributors || []).forEach((c) => { if (c && c.trim()) ensure(c.trim()).answered.push(t); });
    });
    return [...m.values()]
      .map((s) => ({ ...s, total: new Set([...s.asked, ...s.answered].map((t) => t.id)).size, score: s.asked.length + s.answered.length }))
      .sort((a, b) => b.score - a.score || b.total - a.total);
  }, [topics, people]);
  const cohorts = useMemo(() => [...new Set(people.map((p) => p.cohort).filter(Boolean))].sort(), [people]);
  const activeStudent = students.find((s) => s.name === studentName);
  const rosterList = students.filter((s) => (rosterRole === "all" || s.role === rosterRole) && (!rosterCohort || s.cohort === rosterCohort));
  const maxScore = rosterList.reduce((m, s) => Math.max(m, s.score), 0) || 1;

  const openTopic = (t, from) => { setSelectedId(t.id); setDetailFrom(from || "list"); setView("detail"); };
  const openStudent = (name) => { setStudentName(name); setView("student"); };

  const openNew = () => {
    setDraft({ id: null, title: "", category: "", cohort: "", tags: "", discussion: "", conclusion: "", status: "讨论中", asker: "", contributors: [], messages: [] });
    setView("edit");
  };
  const openEdit = (t) => {
    setDraft({ ...t, tags: (t.tags || []).join(", "), asker: t.asker || "", contributors: t.contributors || [], messages: (t.messages || []).map((m) => ({ ...m })) });
    setView("edit");
  };
  const saveDraft = () => {
    if (!draft.title.trim()) return;
    const tags = draft.tags.split(",").map((s) => s.trim()).filter(Boolean);
    const asker = (draft.asker || "").trim();
    const messages = (Array.isArray(draft.messages) ? draft.messages : [])
      .map((m) => ({ id: m.id || uid(), speaker: (m.speaker || "").trim(), text: (m.text || "").trim() }))
      .filter((m) => m.speaker || m.text);
    // anyone who spoke in the discussion counts as a participant
    const picked = (Array.isArray(draft.contributors) ? draft.contributors : []).map((s) => s.trim()).filter(Boolean);
    const contributors = [...new Set([...picked, ...messages.map((m) => m.speaker).filter((n) => n && n !== asker)])];
    const now = Date.now();
    if (draft.id) {
      const next = topics.map((t) => t.id === draft.id ? { ...t, ...draft, tags, contributors, asker, messages, updatedAt: now } : t);
      persist(next); setSelectedId(draft.id); setDetailFrom("list"); setView("detail");
    } else {
      const item = { ...draft, id: uid(), code: nextCode(topics), tags, contributors, asker, messages, createdAt: now, updatedAt: now, category: draft.category.trim() || "未分类" };
      persist([item, ...topics]); setSelectedId(item.id); setDetailFrom("list"); setView("detail");
    }
  };
  const doDelete = (id) => {
    persist(topics.filter((t) => t.id !== id));
    setConfirmDel(null);
    if (selectedId === id) { setSelectedId(null); setView("list"); }
  };

  const globalStyle = `
    * { box-sizing: border-box; }
    ::placeholder { color: ${C.faint}; }
    button, input, textarea, select { font-family: ${sans}; }
    .kb-focus:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
    textarea, input, select { outline: none; }
    textarea:focus, input:focus, select:focus { border-color: ${C.accent} !important; }
    .kb-scroll::-webkit-scrollbar { width: 10px; }
    .kb-scroll::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 8px; border: 3px solid ${C.bg}; }
    @keyframes kb-rot { to { transform: rotate(360deg); } }
    .kb-spin { animation: kb-rot .8s linear infinite; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } .kb-spin { animation-duration: 1.6s; } }
  `;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: sans, color: C.muted }}>
        正在打开知识库…
      </div>
    );
  }

  const inPeople = view === "roster" || view === "student" || view === "directory";

  return (
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: sans, color: C.ink }}>
      <style>{globalStyle}</style>

      {/* Header */}
      <header className="sticky top-0" style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, zIndex: 30 }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ maxWidth: 1160, margin: "0 auto" }}>
          <button className="md:hidden kb-focus" onClick={() => setNavOpen((v) => !v)}
            style={{ border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: 4 }} aria-label="菜单">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2" style={{ cursor: "pointer" }} onClick={() => { setView("list"); setSelectedId(null); }}>
            <BookOpen size={22} style={{ color: C.accent }} strokeWidth={1.8} />
            <div>
              <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, letterSpacing: 0.3, color: C.ink, lineHeight: 1.1 }}>课题知识库</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: C.faint, letterSpacing: 1 }}>TOPIC ARCHIVE</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="relative" style={{ maxWidth: 340, flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
            <input className="kb-focus w-full" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索课题、答案或标签"
              style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 14, color: C.ink, width: "100%" }} />
          </div>
          <button className="kb-focus" onClick={openNew}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Plus size={16} strokeWidth={2.4} /> <span className="hidden md:inline">新增课题</span>
          </button>
        </div>
      </header>

      <div className="flex" style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Sidebar */}
        <aside className={navOpen ? "block" : "hidden md:block"}
          style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${C.line}`, background: C.surface, minHeight: "calc(100vh - 57px)" }}>
          <nav className="kb-scroll" style={{ position: "sticky", top: 57, padding: "18px 14px", maxHeight: "calc(100vh - 57px)", overflowY: "auto" }}>
            <SideHeading text="视图" />
            <SideItem label="课题库" count={topics.length} icon={BookOpen} active={!inPeople}
              onClick={() => { setView("list"); setNavOpen(false); }} />
            <SideItem label="学员积极度" count={students.length} icon={Users} active={view === "roster" || view === "student"}
              onClick={() => { setView("roster"); setNavOpen(false); }} />
            <SideItem label="学员名录" count={people.length} icon={Contact} active={view === "directory"}
              onClick={() => { setView("directory"); setNavOpen(false); }} />

            {!inPeople && <>
              <div style={{ height: 18 }} />
              <SideHeading text="分类" />
              <SideItem label="全部课题" count={topics.length} active={!catFilter} onClick={() => { setCatFilter(null); setNavOpen(false); }} />
              {categories.map(([name, count]) => (
                <SideItem key={name} label={name} count={count} dot={catColor(name)} active={catFilter === name}
                  onClick={() => { setCatFilter(name); setNavOpen(false); }} />
              ))}
              <div style={{ height: 18 }} />
              <SideHeading text="状态" />
              <SideItem label="全部" active={!statusFilter} onClick={() => setStatusFilter(null)} />
              {Object.keys(STATUS).map((s) => (
                <SideItem key={s} label={s} active={statusFilter === s} statusDot={STATUS[s].fg} onClick={() => setStatusFilter(s)} />
              ))}
            </>}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1" style={{ minWidth: 0, padding: "22px 20px 60px" }}>
          {view === "list" && (
            <ListView topics={filtered} total={topics.length} onOpen={(t) => openTopic(t, "list")}
              activeCat={catFilter} activeStatus={statusFilter} search={search} onNew={openNew} people={people} />
          )}
          {view === "detail" && selected && (
            <DetailView t={selected} people={people} onBack={() => setView(detailFrom === "student" ? "student" : "list")}
              onEdit={() => openEdit(selected)} onDelete={() => setConfirmDel(selected.id)} onStudent={openStudent} />
          )}
          {view === "edit" && draft && (
            <EditView draft={draft} setDraft={setDraft} onSave={saveDraft}
              onCancel={() => { if (draft.id) { setSelectedId(draft.id); setView("detail"); } else setView("list"); }}
              categories={categories.map((c) => c[0])} people={people} />
          )}
          {view === "roster" && (
            <RosterView students={rosterList} maxScore={maxScore} onOpen={openStudent}
              role={rosterRole} setRole={setRosterRole} counts={{ student: students.filter((s) => s.role === "student").length, admin: students.filter((s) => s.role === "admin").length, all: students.length }}
              cohort={rosterCohort} setCohort={setRosterCohort} cohorts={cohorts} />
          )}
          {view === "directory" && (
            <DirectoryView people={people} onAdd={addPerson} onUpdate={updatePerson} onDelete={deletePerson} onImport={importPeople} />
          )}
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
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(27,42,74,0.35)", zIndex: 50, padding: 20 }}
          onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(27,42,74,0.2)" }}>
            <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>删除这条课题?</div>
            <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>删除后无法恢复。这条讨论记录和答案会一起移除。</div>
            <div className="flex justify-end gap-3">
              <button className="kb-focus" onClick={() => setConfirmDel(null)}
                style={{ background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button className="kb-focus" onClick={() => doDelete(confirmDel)}
                style={{ background: "#B4453A", color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- sidebar bits --------------------------------------------------
function SideHeading({ text }) {
  return <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase", padding: "0 8px 8px" }}>{text}</div>;
}
function SideItem({ label, count, active, dot, statusDot, icon: Icon, onClick }) {
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
  );
}

// ---- list view -----------------------------------------------------
function ListView({ topics, total, onOpen, activeCat, activeStatus, search, onNew, people = [] }) {
  if (total === 0) {
    return <Empty title="知识库还是空的" body="把老师和学生的第一次讨论、还有最后得出的答案记录进来。之后每一期的新生都能搜到、接着往下问。" cta="记录第一条课题" onCta={onNew} />;
  }
  if (topics.length === 0) {
    return <Empty title="没有匹配的课题" body={`没有找到符合当前条件的记录${search ? "。换个关键词试试" : ""}。`} />;
  }
  return (
    <div>
      <div className="flex items-baseline gap-2" style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>{activeCat || "全部课题"}</h1>
        <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{topics.length} 条{activeStatus ? ` · ${activeStatus}` : ""}</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {topics.map((t) => (
          <article key={t.id} onClick={() => onOpen(t)} className="kb-focus" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onOpen(t)}
            style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, transform .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: C.brass, fontWeight: 600 }}>{t.code}</span>
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: C.muted }}>
                <CatDot category={t.category} /> {t.category || "未分类"}
              </span>
              {t.cohort && <span style={{ fontSize: 12, color: C.faint }}>· {t.cohort}</span>}
              <span className="flex-1" />
              <StatusPill status={t.status} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.ink, lineHeight: 1.4, marginBottom: 6 }}>{t.title}</h2>
            {t.conclusion && (
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {t.conclusion}
              </p>
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
  );
}

// ---- detail view ---------------------------------------------------
function DetailView({ t, people = [], onBack, onEdit, onDelete, onStudent }) {
  const hasPeople = (t.asker && t.asker.trim()) || (t.contributors && t.contributors.length > 0);
  return (
    <div style={{ maxWidth: 720 }}>
      <button className="kb-focus" onClick={onBack}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13.5, marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> 返回
      </button>

      <div className="flex items-center gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: mono, fontSize: 13, color: C.brass, fontWeight: 600 }}>{t.code}</span>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, color: C.inkSoft }}><CatDot category={t.category} /> {t.category || "未分类"}</span>
        {t.cohort && <span style={{ fontSize: 13, color: C.faint }}>· {t.cohort}</span>}
        <span className="flex-1" />
        <StatusPill status={t.status} />
      </div>

      <h1 style={{ fontFamily: serif, fontSize: 27, fontWeight: 600, color: C.ink, lineHeight: 1.35, marginBottom: 16 }}>{t.title}</h1>

      {hasPeople && (
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap", marginBottom: 22, paddingBottom: 20, borderBottom: `1px solid ${C.lineSoft}` }}>
          {t.asker && t.asker.trim() && (
            <button className="kb-focus" onClick={() => onStudent(t.asker.trim())}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 20, padding: "5px 12px 5px 5px", cursor: "pointer" }}>
              <Avatar name={t.asker} size={24} />
              <span style={{ fontSize: 13.5, color: C.ink }}><b style={{ fontWeight: 600 }}>{t.asker}</b> <span style={{ color: C.muted }}>发问</span></span>
              <RoleBadge role={findRole(people, t.asker.trim())} small />
            </button>
          )}
          {t.contributors?.length > 0 && (
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: C.faint }}>回答 / 参与</span>
              {t.contributors.map((c) => (
                <button key={c} className="kb-focus" onClick={() => onStudent(c)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}>
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
          <SectionLabel text={`讨论记录 · ${t.messages.length} 条发言`} />
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            {t.messages.map((m) => {
              const role = findRole(people, m.speaker);
              return (
                <div key={m.id} className="flex" style={{ gap: 10, alignItems: "flex-start" }}>
                  <button className="kb-focus" onClick={() => m.speaker && onStudent(m.speaker)}
                    style={{ background: "transparent", border: "none", padding: 0, cursor: m.speaker ? "pointer" : "default", flexShrink: 0, marginTop: 2 }}>
                    <Avatar name={m.speaker || "?"} size={30} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-1.5" style={{ marginBottom: 3, flexWrap: "wrap" }}>
                      <button className="kb-focus" onClick={() => m.speaker && onStudent(m.speaker)}
                        style={{ background: "transparent", border: "none", padding: 0, cursor: m.speaker ? "pointer" : "default", fontSize: 13.5, fontWeight: 600, color: role === "admin" ? C.brass : C.ink }}>
                        {m.speaker || "未署名"}
                      </button>
                      <RoleBadge role={role} small />
                    </div>
                    <div style={{ background: role === "admin" ? C.brassSoft : C.surface, border: `1px solid ${role === "admin" ? "#EADFC6" : C.line}`, borderRadius: "3px 12px 12px 12px", padding: "9px 13px", fontSize: 14.5, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
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

      <div className="flex items-center gap-3" style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: 18 }}>
        <button className="kb-focus" onClick={onEdit}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}>
          <Pencil size={14} /> 编辑
        </button>
        <button className="kb-focus" onClick={onDelete}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: "#B4453A", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 14, cursor: "pointer" }}>
          <Trash2 size={14} /> 删除
        </button>
      </div>
    </div>
  );
}
function SectionLabel({ text }) {
  return <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{text}</div>;
}

// ---- edit view -----------------------------------------------------
function EditView({ draft, setDraft, onSave, onCancel, categories, people = [] }) {
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const [tagging, setTagging] = useState("idle"); // idle | loading | error
  const inputStyle = { width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 14.5, color: C.ink, lineHeight: 1.6 };
  const canTag = (draft.title + draft.discussion + draft.conclusion).trim().length > 3;

  const msgs = Array.isArray(draft.messages) ? draft.messages : [];
  const addMsg = () => setDraft({ ...draft, messages: [...msgs, { id: uid(), speaker: draft.asker || "", text: "" }] });
  const updateMsg = (i, patch) => setDraft({ ...draft, messages: msgs.map((m, j) => j === i ? { ...m, ...patch } : m) });
  const removeMsg = (i) => setDraft({ ...draft, messages: msgs.filter((_, j) => j !== i) });

  const autoTag = async () => {
    setTagging("loading");
    try {
      let result = null;
      try { result = await generateTags(draft); } catch { result = null; }
      let newTags = result && Array.isArray(result.tags) ? result.tags : null;
      if (!newTags || newTags.length === 0) newTags = localTags(draft);
      const existing = draft.tags.split(",").map((s) => s.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...newTags.map((s) => String(s).trim()).filter(Boolean)])];
      if (merged.length === existing.length && !result) { setTagging("error"); return; }
      setDraft({
        ...draft,
        tags: merged.join(", "),
        category: draft.category.trim() || (result && result.category ? String(result.category).trim() : ""),
      });
      setTagging("idle");
    } catch {
      setTagging("error");
    }
  };
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>{draft.id ? "编辑课题" : "新增课题"}</h1>
        <button className="kb-focus" onClick={onCancel} style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 4 }} aria-label="关闭"><X size={20} /></button>
      </div>

      <Field label="课题标题" required>
        <input className="kb-focus" style={inputStyle} value={draft.title} onChange={set("title")} placeholder="这次讨论的是什么问题?" />
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
          {Object.keys(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="发问学员" hint="从名录里选,也可选管理人">
          <PeoplePicker people={people} value={draft.asker} onChange={(v) => setDraft({ ...draft, asker: v })} placeholder="输入名字或号码" />
        </Field>
        <Field label="回答 / 参与" hint="可多选,含管理人">
          <PeoplePicker people={people} multi value={draft.contributors} onChange={(v) => setDraft({ ...draft, contributors: v })} placeholder="输入名字或号码" />
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
                  <PeoplePicker people={people} value={m.speaker} onChange={(v) => updateMsg(i, { speaker: v })} placeholder="谁说的?" />
                </div>
                <button className="kb-focus" onClick={() => removeMsg(i)} aria-label="删除这条发言"
                  style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6, flexShrink: 0 }}><Trash2 size={15} /></button>
              </div>
              <textarea className="kb-focus" style={{ ...inputStyle, minHeight: 52, resize: "vertical" }} value={m.text}
                onChange={(e) => updateMsg(i, { text: e.target.value })} placeholder="TA 说了什么…" />
            </div>
          ))}
        </div>
        <button className="kb-focus" onClick={addMsg}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.accent, border: `1px dashed #BCD9D7`, borderRadius: 9, padding: "9px 14px", fontSize: 13.5, cursor: "pointer", marginTop: msgs.length ? 10 : 0, width: "100%", justifyContent: "center" }}>
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
          <button className="kb-focus" onClick={autoTag} disabled={!canTag || tagging === "loading"}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.accentSoft, color: C.accent, border: "1px solid #CDE6E4", borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", cursor: canTag && tagging !== "loading" ? "pointer" : "not-allowed", opacity: canTag ? 1 : 0.5 }}>
            {tagging === "loading" ? <Loader2 size={13} className="kb-spin" /> : <Sparkles size={13} />}
            {tagging === "loading" ? "生成中…" : "AI 自动生成"}
          </button>
        </div>
        <input className="kb-focus" style={inputStyle} value={draft.tags} onChange={set("tags")}
          placeholder="点右上角一键生成,或手动输入:文案, ChatGPT, 营销" />
        {tagging === "error" && <div style={{ fontSize: 12.5, color: "#B4453A", marginTop: 6 }}>生成失败,请再试一次,或先手动输入标签。</div>}
        {!canTag && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>先填一点标题或内容,就能自动生成标签。</div>}
      </div>

      <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
        <button className="kb-focus" onClick={onSave} disabled={!draft.title.trim()}
          style={{ background: draft.title.trim() ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14.5, fontWeight: 500, cursor: draft.title.trim() ? "pointer" : "not-allowed" }}>
          {draft.id ? "保存修改" : "保存课题"}
        </button>
        <button className="kb-focus" onClick={onCancel}
          style={{ background: "transparent", color: C.muted, border: "none", borderRadius: 9, padding: "10px 12px", fontSize: 14.5, cursor: "pointer" }}>取消</button>
      </div>
    </div>
  );
}
function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.brass }}> *</span>}
        {hint && <span style={{ fontWeight: 400, color: C.faint, marginLeft: 8, fontSize: 12.5 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ---- empty state ---------------------------------------------------
function Empty({ title, body, cta, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: "80px 20px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <BookOpen size={26} style={{ color: C.accent }} strokeWidth={1.6} />
      </div>
      <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, marginBottom: cta ? 24 : 0 }}>{body}</p>
      {cta && (
        <button className="kb-focus" onClick={onCta}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14.5, cursor: "pointer" }}>
          <Plus size={16} /> {cta}
        </button>
      )}
    </div>
  );
}

// ---- roster (student engagement) -----------------------------------
function RosterView({ students, maxScore, onOpen, role, setRole, counts, cohort, setCohort, cohorts }) {
  const Seg = ({ val, label }) => (
    <button className="kb-focus" onClick={() => setRole(val)}
      style={{ background: role === val ? C.ink : "transparent", color: role === val ? "#fff" : C.inkSoft, border: role === val ? "none" : `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: role === val ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>{counts[val]}</span>
    </button>
  );
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
          <select className="kb-focus" value={cohort || ""} onChange={(e) => setCohort(e.target.value || null)}
            style={{ background: cohort ? C.accentSoft : C.surface, color: cohort ? C.accent : C.inkSoft, border: `1px solid ${cohort ? "#CDE6E4" : C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", marginLeft: 4 }}>
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
          <article key={s.name} onClick={() => onOpen(s.name)} className="kb-focus" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onOpen(s.name)}
            style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
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
  );
}
function CohortChip({ cohort }) {
  return <span style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 11, padding: "1px 7px", borderRadius: 5, fontFamily: sans, whiteSpace: "nowrap" }}>{cohort}</span>;
}
function Stat({ n, label, color }) {
  return (
    <div className="text-center" style={{ minWidth: 40 }}>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color }}>{n}</div>
      <div style={{ fontSize: 11, color: C.faint }}>{label}</div>
    </div>
  );
}

// ---- single student ------------------------------------------------
function StudentView({ s, onBack, onOpenTopic }) {
  const Row = ({ t }) => (
    <button className="kb-focus w-full" onClick={() => onOpenTopic(t)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", marginBottom: 8 }}>
      <span style={{ fontFamily: mono, fontSize: 11.5, color: C.brass, fontWeight: 600, flexShrink: 0 }}>{t.code}</span>
      <span style={{ fontSize: 14, color: C.ink, flex: 1, minWidth: 0, lineHeight: 1.45 }}>{t.title}</span>
      <StatusPill status={t.status} />
    </button>
  );
  return (
    <div style={{ maxWidth: 760 }}>
      <button className="kb-focus" onClick={onBack}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13.5, marginBottom: 18, padding: 0 }}>
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
        {s.asked.length > 0 ? s.asked.map((t) => <Row key={t.id} t={t} />)
          : <p style={{ fontSize: 13.5, color: C.faint }}>还没有以发问者身份记录的课题。</p>}
      </section>

      <section>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
          <MessageCircle size={15} style={{ color: C.accent }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.2, color: C.accent, textTransform: "uppercase", fontWeight: 600 }}>TA 的回答 / 参与 · {s.answered.length}</span>
        </div>
        {s.answered.length > 0 ? s.answered.map((t) => <Row key={t.id} t={t} />)
          : <p style={{ fontSize: 13.5, color: C.faint }}>还没有以参与者身份记录的课题。</p>}
      </section>
    </div>
  );
}

// ---- directory (student roster with contacts) ----------------------
function DirectoryView({ people, onAdd, onUpdate, onDelete, onImport }) {
  const [q, setQ] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [mode, setMode] = useState("list"); // list | import | add
  const [raw, setRaw] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", role: "student", cohort: "" });
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const cohorts = [...new Set(people.map((p) => p.cohort).filter(Boolean))].sort();
  const ql = q.trim().toLowerCase();
  const shown = people.filter((p) => {
    if (cohortFilter && (p.cohort || "") !== cohortFilter) return false;
    if (!ql) return true;
    return p.name.toLowerCase().includes(ql) || (digits(q) && digits(p.phone).includes(digits(q)));
  });
  const preview = mode === "import" ? parsePeople(raw) : [];

  const inputStyle = { width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: C.ink };

  const submitForm = () => {
    if (!form.name.trim()) return;
    if (editId) onUpdate(editId, { name: form.name.trim(), phone: form.phone.trim(), role: form.role, cohort: form.cohort.trim() });
    else onAdd(form);
    setForm({ name: "", phone: "", role: "student", cohort: "" }); setEditId(null); setMode("list");
  };
  const startEdit = (p) => { setForm({ name: p.name, phone: p.phone, role: p.role, cohort: p.cohort || "" }); setEditId(p.id); setMode("add"); };

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
        <div className="flex items-baseline gap-2">
          <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink }}>学员名录</h1>
          <span style={{ fontFamily: mono, fontSize: 12, color: C.faint }}>{people.length} 人</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="kb-focus" onClick={() => { setMode(mode === "import" ? "list" : "import"); setEditId(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 13px", fontSize: 13.5, cursor: "pointer" }}>
            <Upload size={15} /> 导入
          </button>
          <button className="kb-focus" onClick={() => { setForm({ name: "", phone: "", role: "student" }); setEditId(null); setMode(mode === "add" ? "list" : "add"); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 13.5, cursor: "pointer" }}>
            <Plus size={15} /> 新增
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>用名字或联络号码搜索。名字和号码会自动出现在课题的发问 / 回答选择里。</p>

      {mode === "import" && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>批量导入</div>
          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
            每行一个人,格式:<span style={{ fontFamily: mono, color: C.inkSoft }}>名字, 号码, 期数</span>。期数如「第2期」;想标管理人 / 老师就再加一列「管理人」。逗号、Tab 都能分隔,顺序不限。
          </p>
          <textarea className="kb-focus" value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={"陈美玲, 012-3456789, 第1期\n黄晓芳, 017-8899001, 第2期\n郑老师, 019-7778888, 管理人"}
            style={{ ...inputStyle, minHeight: 130, resize: "vertical", fontFamily: mono, lineHeight: 1.7 }} />
          <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
            <button className="kb-focus" onClick={() => { if (preview.length) { onImport(preview); setRaw(""); setMode("list"); } }} disabled={!preview.length}
              style={{ background: preview.length ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 14, cursor: preview.length ? "pointer" : "not-allowed" }}>
              导入 {preview.length || ""} 人
            </button>
            <button className="kb-focus" onClick={() => { setRaw(""); setMode("list"); }}
              style={{ background: "transparent", color: C.muted, border: "none", padding: "9px 8px", fontSize: 14, cursor: "pointer" }}>取消</button>
            {raw.trim() && <span style={{ fontSize: 12.5, color: C.faint }}>识别到 {preview.length} 行有效记录</span>}
          </div>
        </div>
      )}

      {mode === "add" && (
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
              {[["student", "学员"], ["admin", "管理人"]].map(([v, l]) => (
                <button key={v} className="kb-focus" onClick={() => setForm({ ...form, role: v })}
                  style={{ background: form.role === v ? C.ink : "transparent", color: form.role === v ? "#fff" : C.inkSoft, border: form.role === v ? "none" : `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="kb-focus" onClick={submitForm} disabled={!form.name.trim()}
              style={{ background: form.name.trim() ? C.ink : C.line, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>
              {editId ? "保存" : "添加"}
            </button>
            <button className="kb-focus" onClick={() => { setMode("list"); setEditId(null); }}
              style={{ background: "transparent", color: C.muted, border: "none", padding: "9px 8px", fontSize: 14, cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.faint }} />
          <input className="kb-focus w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="用名字或号码搜索"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        {cohorts.length > 0 && (
          <select className="kb-focus" value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}
            style={{ background: cohortFilter ? C.accentSoft : C.surface, color: cohortFilter ? C.accent : C.inkSoft, border: `1px solid ${cohortFilter ? "#CDE6E4" : C.line}`, borderRadius: 9, padding: "9px 10px", fontSize: 13.5, cursor: "pointer" }}>
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
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>名录还是空的。点「导入」粘贴一份名字 + 号码的名单,或「新增」一个个添加。</p>
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
              <button className="kb-focus" onClick={() => startEdit(p)} aria-label="编辑"
                style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6 }}><Pencil size={15} /></button>
              <button className="kb-focus" onClick={() => setConfirm(p)} aria-label="删除"
                style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", padding: 6 }}><Trash2 size={15} /></button>
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
              <button className="kb-focus" onClick={() => { onDelete(confirm.id); setConfirm(null); }} style={{ background: "#B4453A", color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>移除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
