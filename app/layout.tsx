import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import "./site-cursor.css"

export const metadata: Metadata = {
  title: "Reverse : Noir Chronicle | Community",
  description: "Reverse : Noir Chronicle Community access and character gallery.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body className="h-full">
        {children}
        <Script src="/community/rnc/site-cursor.js?v=site-cursor-recovery-20261116-v6" strategy="afterInteractive" />
      </body>
    </html>
  )
}
