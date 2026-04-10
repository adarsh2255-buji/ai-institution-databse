import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "EduAI — AI-Powered Institution Management",
  description: "Manage your tuition center or school with natural language AI. Query student records, attendance, marks, and fees instantly.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
