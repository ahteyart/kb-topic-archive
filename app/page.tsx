import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import KBApp from "@/components/KBApp"

export const dynamic = "force-dynamic"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return <KBApp role={user.role} email={user.email} />
}
