PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS complaints (
 id TEXT PRIMARY KEY,
 tracking_code TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL,
 district TEXT NOT NULL,
 office TEXT NOT NULL DEFAULT '',
 incident_date TEXT,
 body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','verified','rejected','authority_ready','sent')),
 support_count INTEGER NOT NULL DEFAULT 0,
 authority_consent INTEGER NOT NULL DEFAULT 0,
 contact TEXT NOT NULL DEFAULT '',
 moderation_note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT,
 verified_at TEXT,
 sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_complaints_status_created ON complaints(status, created_at DESC);
CREATE TABLE IF NOT EXISTS evidence (
 id TEXT PRIMARY KEY,
 complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 content_type TEXT NOT NULL,
 size INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_complaint ON evidence(complaint_id);
CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY,
 complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL
);
