"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Clapperboard,
  LayoutDashboard,
  ListOrdered,
  Sliders,
  FolderSearch,
  Library,
  Clock,
  Settings,
  X,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/libraries", label: "Libraries", icon: Library },
  { href: "/queue", label: "Queue", icon: ListOrdered },
  { href: "/presets", label: "Presets", icon: Sliders },
  { href: "/watchers", label: "Watchers", icon: FolderSearch },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/"
  }
  return pathname.startsWith(href)
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-[hsl(var(--primary))]" />
          <span className="text-lg font-bold text-[hsl(var(--sidebar-foreground))]">
            HandBrake Web
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] px-4 py-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          HandBrake Web v1.0.0
        </p>
      </div>
    </div>
  )
}
