CREATE TABLE records (
  kind TEXT NOT NULL CHECK (kind IN ('projects','snapshots','plans','approvals','routes','views','groups','policies','settings')),
  id TEXT NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  PRIMARY KEY (kind, id)
);
