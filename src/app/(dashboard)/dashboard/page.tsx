"use client"

import { ActiveJobsCard } from "@/components/dashboard/active-jobs-card"
import { QueueSummaryCard } from "@/components/dashboard/queue-summary"
import { RecentHistoryCard } from "@/components/dashboard/recent-history-card"
import { WatcherStatusCard } from "@/components/dashboard/watcher-status-card"
import { SystemStatsCard } from "@/components/dashboard/system-stats"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ActiveJobsCard />
        <QueueSummaryCard />
        <SystemStatsCard />
        <RecentHistoryCard />
        <WatcherStatusCard />
      </div>
    </div>
  )
}
