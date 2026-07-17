import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "课题知识库 · Topic Archive",
  description: "马来西亚华人 SME AI 教育陪跑计划 · 课题与答案知识库",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
