import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "HandBrake Web",
  description: "Web frontend for HandBrake video encoding",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${inter.variable} font-sans bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
