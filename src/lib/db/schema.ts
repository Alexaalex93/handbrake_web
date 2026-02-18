import type Database from "better-sqlite3"

export function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      source_path   TEXT NOT NULL,
      output_path   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      priority      INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      preset_id     INTEGER REFERENCES presets(id) ON DELETE SET NULL,
      options_json  TEXT NOT NULL,
      progress      REAL DEFAULT 0,
      eta_seconds   INTEGER DEFAULT 0,
      fps           REAL DEFAULT 0,
      avg_fps       REAL DEFAULT 0,
      pass_current  INTEGER DEFAULT 0,
      pass_total    INTEGER DEFAULT 0,
      file_size     INTEGER DEFAULT 0,
      error_message TEXT,
      source_info   TEXT,
      watcher_id    INTEGER REFERENCES watched_folders(id) ON DELETE SET NULL,
      delete_source INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      started_at    TEXT,
      completed_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority_sort ON tasks(priority DESC, sort_order ASC);

    CREATE TABLE IF NOT EXISTS task_history (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      original_task_id INTEGER,
      title            TEXT NOT NULL,
      source_path      TEXT NOT NULL,
      output_path      TEXT NOT NULL,
      status           TEXT NOT NULL,
      options_json     TEXT NOT NULL,
      preset_name      TEXT,
      file_size_in     INTEGER,
      file_size_out    INTEGER,
      encoding_time    INTEGER,
      error_message    TEXT,
      watcher_name     TEXT,
      created_at       TEXT NOT NULL,
      completed_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS presets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT DEFAULT '',
      options_json  TEXT NOT NULL,
      is_default    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      path            TEXT NOT NULL UNIQUE,
      enabled         INTEGER NOT NULL DEFAULT 1,
      recursive       INTEGER NOT NULL DEFAULT 1,
      scan_interval   INTEGER NOT NULL DEFAULT 60,
      file_extensions TEXT NOT NULL DEFAULT '.mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm',
      preset_id       INTEGER REFERENCES presets(id) ON DELETE SET NULL,
      output_mode     TEXT NOT NULL DEFAULT 'fixed',
      output_dir      TEXT,
      output_pattern  TEXT DEFAULT '{name}_encoded.{ext}',
      min_file_size   INTEGER DEFAULT 0,
      last_scan_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scanned_files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      watcher_id    INTEGER NOT NULL REFERENCES watched_folders(id) ON DELETE CASCADE,
      file_path     TEXT NOT NULL,
      file_size     INTEGER NOT NULL,
      file_mtime    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'detected',
      task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(watcher_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS idx_scanned_watcher ON scanned_files(watcher_id);

    CREATE TABLE IF NOT EXISTS schedule (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      enabled       INTEGER NOT NULL DEFAULT 0,
      mode          TEXT NOT NULL DEFAULT 'always',
      time_start    TEXT,
      time_end      TEXT,
      days_of_week  TEXT DEFAULT '0,1,2,3,4,5,6',
      cron_expr     TEXT,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS libraries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      path          TEXT NOT NULL,
      recursive     INTEGER NOT NULL DEFAULT 1,
      file_extensions TEXT NOT NULL DEFAULT '.mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm',
      auto_scan     INTEGER NOT NULL DEFAULT 0,
      scan_interval INTEGER NOT NULL DEFAULT 3600,
      last_scan_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS library_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id    INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      file_path     TEXT NOT NULL,
      file_name     TEXT NOT NULL,
      file_size     INTEGER NOT NULL DEFAULT 0,
      file_mtime    TEXT,
      duration      REAL,
      width         INTEGER,
      height        INTEGER,
      video_codec   TEXT,
      video_bitrate INTEGER,
      audio_codec   TEXT,
      audio_channels INTEGER,
      audio_bitrate INTEGER,
      subtitle_count INTEGER DEFAULT 0,
      container     TEXT,
      scan_status   TEXT NOT NULL DEFAULT 'pending',
      scan_error    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(library_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS idx_library_items_library ON library_items(library_id);
    CREATE INDEX IF NOT EXISTS idx_library_items_codec ON library_items(video_codec);
  `)

  // Seed default settings
  const seedSettings = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `)
  const defaults: Record<string, string> = {
    concurrent_limit: "1",
    handbrake_path: "HandBrakeCLI",
    ffprobe_path: "ffprobe",
    default_output_dir: "/output",
    default_output_pattern: "{name}_encoded.{ext}",
    auto_start_queue: "true",
  }
  for (const [key, value] of Object.entries(defaults)) {
    seedSettings.run(key, value)
  }

  // Seed default schedule
  db.prepare(`
    INSERT OR IGNORE INTO schedule (id, enabled, mode) VALUES (1, 0, 'always')
  `).run()

  // Migrations for existing databases
  try {
    db.prepare("SELECT delete_source FROM tasks LIMIT 0").get()
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN delete_source INTEGER NOT NULL DEFAULT 0")
  }

  try {
    db.prepare("SELECT replace_source FROM tasks LIMIT 0").get()
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN replace_source INTEGER NOT NULL DEFAULT 0")
  }

  // Add delete/replace source to watched_folders
  try {
    db.prepare("SELECT delete_source FROM watched_folders LIMIT 0").get()
  } catch {
    db.exec("ALTER TABLE watched_folders ADD COLUMN delete_source INTEGER NOT NULL DEFAULT 0")
  }
  try {
    db.prepare("SELECT replace_source FROM watched_folders LIMIT 0").get()
  } catch {
    db.exec("ALTER TABLE watched_folders ADD COLUMN replace_source INTEGER NOT NULL DEFAULT 0")
  }

  // Recovery: reset any tasks stuck in "encoding" state (server crashed)
  db.prepare(`
    UPDATE tasks SET status = 'queued', progress = 0, eta_seconds = 0, fps = 0, avg_fps = 0
    WHERE status = 'encoding'
  `).run()
}
