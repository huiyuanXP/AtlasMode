import { useState } from 'react';
import type { GroupRecord } from '../../api/client.js';
interface Props {
  items: GroupRecord[];
  selectedIds: string[];
  busy: boolean;
  onSave: (
    data: {
      name: string;
      type: 'capability';
      members: string[];
      description: string;
      source: 'user';
      guidance: 'reference' | 'must_reuse';
    },
    record?: GroupRecord,
  ) => Promise<boolean>;
  onDelete: (record: GroupRecord) => Promise<void>;
  onShow: (ids: string[]) => void;
}
export function GroupPanel({
  items,
  selectedIds,
  busy,
  onSave,
  onDelete,
  onShow,
}: Props) {
  const [editing, setEditing] = useState<GroupRecord | undefined>(),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [guidance, setGuidance] = useState<'reference' | 'must_reuse'>('reference'),
    [replaceMembers, setReplaceMembers] = useState(false);
  const members = editing && !replaceMembers ? editing.members : selectedIds;
  return (
    <section>
      <h2>功能集</h2>
      <p>
        按住 Shift 框选多个真实函数。成员可以跨目录；分组不会生成 wrapper
        或移动源码。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(
            {
              name,
              type: 'capability',
              members,
              description,
              source: 'user',
              guidance,
            },
            editing,
          ).then((saved) => {
            if (saved) {
              setEditing(undefined);
              setName('');
              setDescription('');
            }
          });
        }}
      >
        <label>
          功能集名称
          <input
            aria-label="功能集名称"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          说明
          <textarea
            aria-label="功能集说明"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          复用指引
          <select
            value={guidance}
            onChange={(event) =>
              setGuidance(event.target.value as typeof guidance)
            }
          >
            <option value="reference">建议参考</option>
            <option value="must_reuse">必须复用（规划需明确具体函数）</option>
          </select>
        </label>
        {editing && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={replaceMembers}
              onChange={(event) => setReplaceMembers(event.target.checked)}
            />
            用当前框选函数替换成员
          </label>
        )}
        <p className="muted">当前成员：{members.length} 个函数</p>
        <button disabled={busy || !name.trim() || !members.length}>
          {editing ? '保存功能集' : '创建功能集'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setName('');
              setDescription('');
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
              {item.name} · v{item.revision}
            </strong>
            <p>{item.description}</p>
            <span className="muted">
              {item.members.length} 个成员 ·{' '}
              {item.source === 'agent' ? 'Agent' : '用户'}
              {item.orphanedMembers.length
                ? ` · ${item.orphanedMembers.length} 个待绑定`
                : ''}
            </span>
            <div className="actions">
              <button
                onClick={() =>
                  onShow(
                    item.members.filter(
                      (id) => !item.orphanedMembers.includes(id),
                    ),
                  )
                }
              >
                显示成员
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(item);
                  setReplaceMembers(false);
                  setName(item.name);
                  setDescription(item.description);
                  setGuidance(item.guidance);
                }}
              >
                编辑功能集
              </button>
              <button disabled={busy} onClick={() => void onDelete(item)}>
                删除功能集
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
