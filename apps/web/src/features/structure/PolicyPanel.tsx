import { useState } from 'react';
import type { FolderPolicy } from '@codemap/core';
interface Props {
  items: FolderPolicy[];
  busy: boolean;
  onSave: (
    data: {
      path: string;
      purpose: string;
      forbiddenDependencies: string[];
      allowedDependencies: string[];
      exceptions: { dependency: string; reason: string }[];
    },
    record?: FolderPolicy,
  ) => Promise<boolean>;
  onDelete: (record: FolderPolicy) => Promise<void>;
}
export function PolicyPanel({ items, busy, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<FolderPolicy | undefined>(),
    [folder, setFolder] = useState('src/services'),
    [purpose, setPurpose] = useState(''),
    [forbidden, setForbidden] = useState('');
  return (
    <section>
      <h2>目录约束</h2>
      <p>
        职责说明供人和 Agent
        理解。明确禁止的依赖路径可在规划阶段检查；自然语言职责不自动判定。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(
            {
              path: folder,
              purpose,
              forbiddenDependencies: forbidden
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean),
              allowedDependencies: editing?.allowedDependencies ?? [],
              exceptions: editing?.exceptions ?? [],
            },
            editing,
          ).then((saved) => {
            if (saved) {
              setEditing(undefined);
              setPurpose('');
            }
          });
        }}
      >
        <label>
          目录相对路径
          <input
            aria-label="目录相对路径"
            value={folder}
            required
            onChange={(event) => setFolder(event.target.value)}
          />
        </label>
        <label>
          目录职责
          <textarea
            aria-label="目录职责"
            value={purpose}
            required
            onChange={(event) => setPurpose(event.target.value)}
          />
        </label>
        <label>
          禁止依赖的路径（每行一个）
          <textarea
            aria-label="禁止依赖"
            value={forbidden}
            onChange={(event) => setForbidden(event.target.value)}
          />
        </label>
        <button disabled={busy || !purpose.trim()}>
          {editing ? '保存目录约束' : '添加目录约束'}
        </button>
        {editing && (
          <button type="button" onClick={() => setEditing(undefined)}>
            取消编辑
          </button>
        )}
      </form>
      <ul className="record-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>
              {item.path} · v{item.revision}
            </strong>
            <p>{item.purpose}</p>
            <p className="muted">
              禁止：{item.forbiddenDependencies.join(', ') || '未设置'}
            </p>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(item);
                  setFolder(item.path);
                  setPurpose(item.purpose);
                  setForbidden(item.forbiddenDependencies.join('\n'));
                }}
              >
                编辑目录约束
              </button>
              <button disabled={busy} onClick={() => void onDelete(item)}>
                删除目录约束
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
