"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { C, serif, mono } from "@/lib/tokens"

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: C.bg }} />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setError(errMsg(error.message))
      setBusy(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 9,
    padding: "11px 12px",
    fontSize: 15,
    color: C.ink,
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: C.bg, padding: 20 }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          className="flex items-center gap-2"
          style={{ justifyContent: "center", marginBottom: 22 }}
        >
          <BookOpen size={26} style={{ color: C.accent }} strokeWidth={1.8} />
          <div>
            <div
              style={{
                fontFamily: serif,
                fontSize: 20,
                fontWeight: 600,
                color: C.ink,
                lineHeight: 1.1,
              }}
            >
              课题知识库
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                color: C.faint,
                letterSpacing: 1,
              }}
            >
              TOPIC ARCHIVE
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: 24,
            boxShadow: "0 12px 40px rgba(27,42,74,0.06)",
          }}
        >
          <div
            style={{
              fontFamily: serif,
              fontSize: 18,
              fontWeight: 600,
              color: C.ink,
              marginBottom: 4,
            }}
          >
            管理人登录
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            用邮箱和密码登录后台。
          </p>

          <label
            style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}
          >
            邮箱
          </label>
          <input
            className="kb-focus"
            style={{ ...inputStyle, marginBottom: 14 }}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label
            style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.inkSoft, marginBottom: 6 }}
          >
            密码
          </label>
          <input
            className="kb-focus"
            style={{ ...inputStyle, marginBottom: 18 }}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <div
              style={{
                fontSize: 13,
                color: C.danger,
                background: "#FBEAE8",
                border: "1px solid #F0CFC9",
                borderRadius: 8,
                padding: "8px 11px",
                marginBottom: 14,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="kb-focus"
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: busy ? C.faint : C.ink,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 16px",
              fontSize: 15,
              fontWeight: 500,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy && <Loader2 size={15} className="kb-spin" />}
            {busy ? "登录中…" : "登录"}
          </button>
        </form>

        <p
          style={{
            fontSize: 12.5,
            color: C.faint,
            textAlign: "center",
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          还没有账号?请在 Supabase 后台创建第一个管理员(见 README)。
        </p>
      </div>
    </div>
  )
}

function errMsg(raw: string): string {
  if (/invalid login credentials/i.test(raw)) return "邮箱或密码不正确。"
  if (/email not confirmed/i.test(raw)) return "邮箱尚未验证,请先在 Supabase 后台确认。"
  return raw
}
