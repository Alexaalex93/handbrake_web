import Database from "better-sqlite3"
import path from "path"
import { initializeSchema } from "./schema"

const DB_PATH = path.join(process.cwd(), "data", "handbrake.db")

function createDatabase(): Database.Database {
  const fs = require("fs")
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(DB_PATH)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  db.pragma("busy_timeout = 5000")

  initializeSchema(db)

  return db
}

// Singleton pattern surviving Next.js hot reloads
const globalForDb = globalThis as unknown as {
  __db: Database.Database | undefined
}

export function getDb(): Database.Database {
  if (!globalForDb.__db) {
    globalForDb.__db = createDatabase()
  }
  return globalForDb.__db
}
