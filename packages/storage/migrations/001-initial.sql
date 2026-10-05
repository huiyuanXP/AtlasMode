CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE snapshots (id TEXT PRIMARY KEY, repository_id TEXT NOT NULL, created_at TEXT NOT NULL, baseline_digest TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX snapshot_date ON snapshots(created_at DESC);
CREATE TABLE entities (kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE TABLE plan_history (id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(id,revision));
CREATE TABLE audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, data TEXT);
