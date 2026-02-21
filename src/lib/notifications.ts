import { getDb } from "@/lib/db"

export interface NotificationSettings {
  enabled: boolean
  telegramBotToken: string
  telegramChatId: string
  webhookUrl: string
  notifyOnStart: boolean
  notifyOnComplete: boolean
  notifyOnError: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  telegramBotToken: "",
  telegramChatId: "",
  webhookUrl: "",
  notifyOnStart: true,
  notifyOnComplete: true,
  notifyOnError: true,
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("notifications") as { value: string } | undefined
    if (row?.value) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run("notifications", JSON.stringify(settings))
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export async function notifyEncodingStart(data: {
  title: string
  sourcePath: string
  fileSize: number
}): Promise<void> {
  const settings = getNotificationSettings()
  if (!settings.enabled || !settings.notifyOnStart) return

  const message = `🎬 Encoding started\n📄 ${data.title}\n📁 ${data.sourcePath}\n💾 ${formatBytes(data.fileSize)}`
  await sendNotifications(settings, message)
}

export async function notifyEncodingComplete(data: {
  title: string
  sourcePath: string
  sizeIn: number
  sizeOut: number
  duration: number
}): Promise<void> {
  const settings = getNotificationSettings()
  if (!settings.enabled || !settings.notifyOnComplete) return

  const ratio = data.sizeIn > 0 ? ((data.sizeOut / data.sizeIn) * 100).toFixed(0) : "?"
  const saved = data.sizeIn - data.sizeOut
  const mins = Math.floor(data.duration / 60)
  const secs = data.duration % 60

  const message = `✅ Encoding complete\n📄 ${data.title}\n📥 ${formatBytes(data.sizeIn)} → 📤 ${formatBytes(data.sizeOut)} (${ratio}%)\n💰 Saved ${formatBytes(saved)}\n⏱ ${mins}m ${secs}s`
  await sendNotifications(settings, message)
}

export async function notifyEncodingError(data: {
  title: string
  sourcePath: string
  error: string
}): Promise<void> {
  const settings = getNotificationSettings()
  if (!settings.enabled || !settings.notifyOnError) return

  const message = `❌ Encoding failed\n📄 ${data.title}\n📁 ${data.sourcePath}\n⚠️ ${data.error}`
  await sendNotifications(settings, message)
}

async function sendNotifications(settings: NotificationSettings, message: string): Promise<void> {
  const promises: Promise<void>[] = []

  // Telegram
  if (settings.telegramBotToken && settings.telegramChatId) {
    promises.push(sendTelegram(settings.telegramBotToken, settings.telegramChatId, message))
  }

  // Generic webhook (Discord, Slack, etc.)
  if (settings.webhookUrl) {
    promises.push(sendWebhook(settings.webhookUrl, message))
  }

  try {
    await Promise.allSettled(promises)
  } catch (err) {
    console.error("[notifications] Error sending notifications:", err)
  }
}

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[notifications] Telegram error:", err)
    }
  } catch (err) {
    console.error("[notifications] Telegram send failed:", err)
  }
}

async function sendWebhook(url: string, message: string): Promise<void> {
  try {
    // Try Discord format first (content field), fallback works for most webhooks
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,       // Discord
        text: message,          // Slack
        message,                // Generic
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[notifications] Webhook error:", err)
    }
  } catch (err) {
    console.error("[notifications] Webhook send failed:", err)
  }
}
