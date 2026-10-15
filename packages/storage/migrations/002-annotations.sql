CREATE TABLE records_next (
  kind TEXT NOT NULL CHECK (kind IN ('projects','snapshots','plans','approvals','routes','views','groups','policies','settings','annotations')),
  id TEXT NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  PRIMARY KEY (kind, id)
);
INSERT INTO records_next (rowid, kind, id, value)
  SELECT rowid, kind, id, value FROM records ORDER BY rowid;
DROP TABLE records;
ALTER TABLE records_next RENAME TO records;
INSERT INTO records (kind, id, value)
  SELECT 'settings', 'annotation-review-legacy-v1',
    json_object('version', 1, 'approvalIds', json(
      (SELECT json_group_array(id) FROM
        (SELECT id FROM records WHERE kind = 'approvals' ORDER BY id COLLATE BINARY))
    ));
