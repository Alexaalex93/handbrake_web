import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SWRProvider } from "@/components/swr-provider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "HandBrake Web",
  description: "Web frontend for HandBrake video encoding",
  icons: {
    icon: "/icon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${inter.variable} font-sans overflow-x-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased`}
      >
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  )
}
