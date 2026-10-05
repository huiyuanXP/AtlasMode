import { useState } from 'react';
import type { AnnotationRecord } from '../../api/client.js';
interface Props {
  items: AnnotationRecord[];
  targetId: string | null;
  busy: boolean;
  onSave: (
    data: {
      targetId: string;
      text: string;
      source: 'user';
      constraint: boolean;
    },
    record?: AnnotationRecord,
  ) => Promise<boolean>;
  onDelete: (record: AnnotationRecord) => Promise<void>;
}
export function AnnotationPanel({
  items,
  targetId,
  busy,
  onSave,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState<AnnotationRecord | undefined>(),
    [text, setText] = useState(''),
    [constraint, setConstraint] = useState(false),
    [rebind, setRebind] = useState(false);
  return (
    <section>
      <h2>注释与约束</h2>
      <p>选中函数或文件后添加注释。重新索引不会删除失去绑定的注释。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const target = rebind ? targetId : (editing?.targetId ?? targetId);
          if (target)
            void onSave(
              { targetId: target, text, source: 'user', constraint },
              editing,
            ).then((saved) => {
              if (saved) {
                setEditing(undefined);
                setText('');
              }
            });
        }}
      >
        <label>
          注释内容
          <textarea
            aria-label="注释内容"
            value={text}
            required
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <p className="muted">
          目标：
          {rebind
            ? targetId
            : (editing?.targetId ?? targetId ?? '请先选择节点')}
        </p>
        {editing && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rebind}
              onChange={(event) => setRebind(event.target.checked)}
            />
            重新绑定到当前选中节点
          </label>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={constraint}
            onChange={(event) => setConstraint(event.target.checked)}
          />
          作为约束记录
        </label>
        <button disabled={busy || (!targetId && !editing) || !text.trim()}>
          {editing ? '保存注释' : '添加注释'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setText('');
            }}
          >
            取消编辑
          </button>
        )}
      </form>
      <ul className="record-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>
              {item.constraint ? '约束' : '注释'} ·{' '}
              {item.source === 'agent' ? 'Agent' : '用户'} · v{item.revision}
            </strong>
            <p>{item.text}</p>
            <span className="muted">
              {item.binding === 'orphaned' ? '待重新绑定' : item.targetId}
            </span>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(item);
                  setText(item.text);
                  setConstraint(item.constraint);
                  setRebind(false);
                }}
              >
                编辑注释
              </button>
              <button disabled={busy} onClick={() => void onDelete(item)}>
                删除注释
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
