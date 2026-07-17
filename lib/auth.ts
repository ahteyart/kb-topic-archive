import { createClient } from "@/lib/supabase/server"
import type { MemberRole } from "@/lib/database.types"

export type SessionProfile = {
  id: string
  email: string | null
  role: MemberRole
}

// Current signed-in user + their role. null if not signed in.
export async function getCurrentUser(): Promise<SessionProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    role: (profile?.role ?? "student") as MemberRole,
  }
}

export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentUser()
  return u?.role === "admin"
}
