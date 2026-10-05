import { useState } from 'react';
import type {
  CodeNode,
  FunctionNode,
  PlanChange,
  PlanInput,
  PlanRevision,
} from '@codemap/core';
export function planInput(plan: PlanRevision): PlanInput {
  return {
    baselineSnapshotId: plan.baselineSnapshotId,
    title: plan.title,
    reason: plan.reason,
    source: 'user',
    changes: plan.changes,
    requirements: plan.requirements,
  };
}
interface Props {
  plans: PlanRevision[];
  currentSnapshotId: string;
  active: PlanRevision | null;
  functions: FunctionNode[];
  nodes: CodeNode[];
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (input: Omit<PlanInput, 'baselineSnapshotId'>) => Promise<boolean>;
  onSave: (input: PlanInput) => Promise<boolean>;
  onValidate: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onVerify: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
type FunctionChange = Extract<
  PlanChange,
  { op: 'add_function' | 'update_function' }
>;
function FunctionEditor({
  change,
  fallback,
  onSave,
  onDelete,
  busy,
}: {
  change: FunctionChange;
  fallback: { name: string; signature: string; filePath: string };
  onSave: (values: {
    name: string;
    signature: string;
    filePath: string;
  }) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState(change.name ?? fallback.name),
    [signature, setSignature] = useState(
      change.signature ?? fallback.signature,
    ),
    [file, setFile] = useState(change.filePath ?? fallback.filePath);
  return (
    <form
      className="change-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, signature, filePath: file });
      }}
    >
      <strong>
        {change.op === 'add_function' ? '规划新增' : '规划修改'}函数
      </strong>
      <label>
        函数名称
        <input
          aria-label={`函数名称 ${'id' in change ? change.id : change.functionId}`}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        目标文件
        <input
          aria-label={`目标文件 ${'id' in change ? change.id : change.functionId}`}
          maxLength={200}
          required
          value={file}
          onChange={(event) => setFile(event.target.value)}
        />
      </label>
      <label>
        接口签名
        <input
          aria-label={`接口签名 ${'id' in change ? change.id : change.functionId}`}
          required
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
        />
      </label>
      <p className="muted">路径预览：{file} · 仅修改规划</p>
      <div className="actions">
        <button disabled={busy}>保存函数更改</button>
        <button type="button" disabled={busy} onClick={onDelete}>
          删除此规划变更
        </button>
      </div>
    </form>
  );
}
function PlanDetailsEditor({
  plan,
  currentSnapshotId,
  busy,
  onSave,
}: {
  plan: PlanRevision;
  currentSnapshotId: string;
  busy: boolean;
  onSave: (input: PlanInput) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(plan.title),
    [reason, setReason] = useState(plan.reason);
  return (
    <details>
      <summary>编辑规划说明与基线</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ ...planInput(plan), title, reason });
        }}
      >
        <label>
          规划标题
          <input
            aria-label="编辑规划标题"
            value={title}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          规划理由
          <textarea
            aria-label="编辑规划理由"
            value={reason}
            required
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button disabled={busy}>保存规划说明</button>
      </form>
      {currentSnapshotId !== plan.baselineSnapshotId && (
        <>
          <p className="error-text">当前代码快照已变化；旧确认不能用于实施。</p>
          <button
            disabled={busy}
            onClick={() =>
              void onSave({
                ...planInput(plan),
                baselineSnapshotId: currentSnapshotId,
              })
            }
          >
            使用当前快照创建新版本
          </button>
        </>
      )}
    </details>
  );
}
export function PlanPanel(props: Props) {
  const { active, busy } = props;
  const [title, setTitle] = useState('添加 fetchNotes 并复用已有能力'),
    [reason, setReason] = useState('复用已有请求封装，避免新增重复辅助函数'),
    [name, setName] = useState('fetchNotes'),
    [file, setFile] = useState('src/services/notes.ts'),
    [signature, setSignature] = useState('() => string'),
    [source, setSource] = useState(''),
    [target, setTarget] = useState(''),
    [required, setRequired] = useState(true);
  const choices = [
    ...props.functions.map((fn) => ({ id: fn.id, name: fn.qualifiedName })),
    ...(active?.changes
      .filter((change) => change.op === 'add_function')
      .map((change) => ({ id: change.id, name: change.name + '（规划）' })) ??
      []),
  ];
  const save = (changes: PlanChange[]) =>
    active
      ? props.onSave({ ...planInput(active), changes })
      : Promise.resolve(false);
  const remove = (index: number) => {
    if (!active) return;
    const change = active.changes[index]!;
    const id = change.op === 'add_function' ? change.id : null;
    void props.onSave({
      ...planInput(active),
      changes: active.changes.filter(
        (item, i) =>
          i !== index &&
          !(
            id &&
            item.op === 'add_call' &&
            (item.source === id || item.target === id)
          ),
      ),
      requirements: active.requirements.filter(
        (item) => item.nodeId !== id && item.target !== id,
      ),
    });
  };
  return (
    <section>
      <h2>实施前规划</h2>
      <p>
        代码事实不会被画布编辑覆盖。语义修改创建新版本并撤销旧确认；布局调整不撤销确认。
      </p>
      <label>
        已有规划
        <select
          aria-label="选择规划"
          value={active?.id ?? ''}
          onChange={(event) => props.onSelect(event.target.value)}
        >
          <option value="">新建规划</option>
          {props.plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title} · v{plan.revision} · {plan.status}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <div className="plan-status">
          <strong>
            {active.title} · v{active.revision}
          </strong>
          <span>
            状态：{active.status} ·{' '}
            {active.approval ? '已绑定人工确认' : '未确认'}
          </span>
          <small>
            基线：{active.baselineSnapshotId}
            <br />
            语义摘要：{active.semanticHash.slice(0, 16)}
          </small>
          <div className="actions">
            <button disabled={busy || !props.canUndo} onClick={props.onUndo}>
              撤销语义修改
            </button>
            <button disabled={busy || !props.canRedo} onClick={props.onRedo}>
              重做语义修改
            </button>
          </div>
        </div>
      )}
      {active && (
        <PlanDetailsEditor
          key={active.id + ':' + active.revision}
          plan={active}
          currentSnapshotId={props.currentSnapshotId}
          busy={busy}
          onSave={props.onSave}
        />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const change: PlanChange = {
            op: 'add_function',
            id: `plan:${crypto.randomUUID()}`,
            name,
            signature,
            filePath: file,
          };
          void (active
            ? save([...active.changes, change])
            : props.onCreate({
                title,
                reason,
                source: 'user',
                changes: [change],
                requirements: [],
              }));
        }}
      >
        {!active && (
          <>
            <label>
              规划标题
              <input
                aria-label="规划标题"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              规划理由
              <textarea
                aria-label="规划理由"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </>
        )}
        <details open={!active}>
          <summary>新增规划函数</summary>
          <label>
            新函数名称
            <input
              aria-label="新函数名称"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            新函数目标文件
            <input
              aria-label="新函数目标文件"
              required
              maxLength={200}
              value={file}
              onChange={(event) => setFile(event.target.value)}
            />
          </label>
          <label>
            新函数接口
            <input
              aria-label="新函数接口"
              required
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
            />
          </label>
          <button disabled={busy}>
            {active ? '添加规划函数' : '创建规划'}
          </button>
        </details>
      </form>
      {active && (
        <>
          {active.changes.map((change, index) => {
            if (
              change.op === 'add_function' ||
              change.op === 'update_function'
            ) {
              const fn =
                change.op === 'update_function'
                  ? props.functions.find((fn) => fn.id === change.functionId)
                  : undefined;
              const fileNode = props.nodes.find(
                (node) => node.id === fn?.fileId,
              );
              return (
                <FunctionEditor
                  key={`${index}:${active.revision}`}
                  change={change}
                  fallback={{
                    name: fn?.name ?? '',
                    signature: fn?.signature ?? '',
                    filePath: fileNode?.kind === 'file' ? fileNode.path : '',
                  }}
                  busy={busy}
                  onSave={(values) => {
                    void save(
                      active.changes.map((item, i) =>
                        i === index ? { ...change, ...values } : item,
                      ),
                    );
                  }}
                  onDelete={() => remove(index)}
                />
              );
            }
            if (change.op === 'add_call')
              return (
                <div className="change-card" key={change.id}>
                  <strong>
                    规划调用：
                    {choices.find((item) => item.id === change.source)?.name ??
                      change.source}
                  </strong>
                  <label>
                    调用目标
                    <select
                      aria-label={`调用目标 ${change.id}`}
                      disabled={busy}
                      value={change.target}
                      onChange={(event) => {
                        const next = event.target.value;
                        void props.onSave({
                          ...planInput(active),
                          changes: active.changes.map((item, i) =>
                            i === index ? { ...change, target: next } : item,
                          ),
                          requirements: active.requirements.map((item) =>
                            (item.type === 'must_call' ||
                              item.type === 'must_reuse') &&
                            item.nodeId === change.source &&
                            item.target === change.target
                              ? { ...item, target: next }
                              : item,
                          ),
                        });
                      }}
                    >
                      {!choices.some((item) => item.id === change.target) && (
                        <option value={change.target}>{change.target}</option>
                      )}
                      {choices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy} onClick={() => remove(index)}>
                    删除规划调用
                  </button>
                </div>
              );
            return (
              <div className="change-card" key={index}>
                <strong>
                  {change.op === 'delete_function'
                    ? '规划删除函数'
                    : '规划删除关系'}
                </strong>
                <p>
                  {change.op === 'delete_function'
                    ? change.functionId
                    : change.relationId}
                </p>
                <button disabled={busy} onClick={() => remove(index)}>
                  撤回删除变更
                </button>
              </div>
            );
          })}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!source || !target) return;
              void props.onSave({
                ...planInput(active),
                changes: [
                  ...active.changes,
                  {
                    op: 'add_call',
                    id: `plan:${crypto.randomUUID()}`,
                    source,
                    target,
                  },
                ],
                requirements: required
                  ? [
                      ...active.requirements,
                      {
                        type: 'must_call',
                        nodeId: source,
                        target,
                        reason: '复用用户指定的已有能力',
                      },
                    ]
                  : active.requirements,
              });
            }}
          >
            <h3>添加调用关系</h3>
            <label>
              调用方
              <select
                aria-label="调用方"
                required
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="">选择函数</option>
                {choices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              被调用方
              <select
                aria-label="被调用方"
                required
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">选择函数</option>
                {choices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />
              同时记录必须复用要求
            </label>
            <button disabled={busy || !source || !target}>添加规划调用</button>
          </form>
          {active.requirements.length > 0 && (
            <details open>
              <summary>明确要求</summary>
              {active.requirements.map((item, index) => (
                <p key={index}>
                  {item.type} · {item.reason}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void props.onSave({
                        ...planInput(active),
                        requirements: active.requirements.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    移除要求
                  </button>
                </p>
              ))}
            </details>
          )}
          <div className="validation">
            <h3>校验与审批</h3>
            {active.validation.errors.map((item, i) => (
              <p className="error-text" key={i}>
                错误：{item}
              </p>
            ))}
            {active.validation.unknown.map((item, i) => (
              <p className="muted" key={i}>
                无法自动判定：{item}
              </p>
            ))}
            <div className="actions">
              <button
                disabled={busy || active.status === 'cancelled'}
                onClick={props.onValidate}
              >
                校验当前版本
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  active.status !== 'validated' ||
                  active.validation.errors.length > 0
                }
                onClick={props.onApprove}
              >
                确认此规划版本
              </button>
              <button
                disabled={busy || !active.approval}
                onClick={props.onVerify}
              >
                重新索引并核对
              </button>
              <button
                disabled={busy || active.status === 'cancelled'}
                onClick={props.onCancel}
              >
                取消规划
              </button>
            </div>
            <p className="muted">
              确认仅固定意图，不自动修改源码。Agent
              必须读取有效的已确认版本后实施。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
