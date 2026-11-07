-- 雙半馬冒險路線：D1 schema（v1）
-- 各表的 x 欄位：存放頁面寫入、但沒有專屬欄位的其他欄位（JSON），避免資料遺失。

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,                 -- icu-{事件編號} 或 icu-act-{活動編號}，或頁面新增的自動編號
  date TEXT NOT NULL,
  title TEXT NOT NULL,                 -- intervals.icu 原名，不改寫
  kind TEXT NOT NULL,
  mins INTEGER,
  desc TEXT,                           -- 課表說明（展示版不得輸出）
  done INTEGER NOT NULL DEFAULT 0,     -- 頁面勾選，同步不覆蓋
  done_at TEXT,                        -- 同步不覆蓋
  key INTEGER NOT NULL DEFAULT 0,      -- 同步不覆蓋
  source TEXT,
  unplanned INTEGER NOT NULL DEFAULT 0,
  note TEXT,                           -- 可能含心率與負荷（展示版不得輸出）
  removed_from_icu INTEGER NOT NULL DEFAULT 0,
  actual TEXT,                         -- JSON：{min,km,avgHr,load}
  created_at TEXT,
  x TEXT
);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);

CREATE TABLE IF NOT EXISTS wellness (
  date TEXT PRIMARY KEY,
  rhr REAL, hrv REAL, ctl REAL, atl REAL,
  sleep_h REAL, sleep_score REAL,
  missing INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  x TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,                 -- {race}__{item}
  race TEXT NOT NULL,
  item TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  x TEXT
);

CREATE TABLE IF NOT EXISTS checkitems (
  id TEXT PRIMARY KEY,
  race TEXT NOT NULL,
  label TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  x TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  t TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  x TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  t TEXT NOT NULL,
  trigger TEXT NOT NULL,               -- cron / request
  range_from TEXT, range_to TEXT,
  added INTEGER DEFAULT 0, updated INTEGER DEFAULT 0, removed INTEGER DEFAULT 0, skipped INTEGER DEFAULT 0,
  error TEXT,
  detail TEXT                          -- JSON：略過、對不上、警告、失敗項目的清單
);

CREATE TABLE IF NOT EXISTS sync_requests (
  id TEXT PRIMARY KEY,
  t TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  x TEXT
);
