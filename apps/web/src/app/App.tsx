import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, Edge, Viewport } from '@xyflow/react';
import type {
  PlanRevision,
  PlanInput,
  PlanChange,
  FunctionNode,
  FolderPolicy,
  ViewState,
  VerificationReport,
  KnowledgeExport,
  IdentityRecord,
} from '@codemap/core';
import { PlanSchema } from '@codemap/core';
import { api, idPath, ApiError } from '../api/client.js';
import type {
  WorkspaceData,
  ProjectSummary,
  FunctionResults,
  FunctionContext,
  GraphData,
  Records,
  AnnotationRecord,
  GroupRecord,
} from '../api/client.js';
import { CodeCanvas } from '../features/graph/CodeCanvas.js';
import { PlanPanel, planInput } from '../features/planning/PlanPanel.js';
import { AnnotationPanel } from '../features/annotations/AnnotationPanel.js';
import { GroupPanel } from '../features/groups/GroupPanel.js';
import { PolicyPanel } from '../features/structure/PolicyPanel.js';
import { VerificationPanel } from '../features/verification/VerificationPanel.js';
const tabs = [
  ['planning', '规划'],
  ['annotations', '注释'],
  ['groups', '功能集'],
  ['policies', '目录约束'],
  ['verification', '核对'],
] as const;
export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null),
    [results, setResults] = useState<FunctionResults | null>(null),
    [query, setQuery] = useState(''),
    [context, setContext] = useState<FunctionContext | null>(null),
    [active, setActive] = useState<PlanRevision | null>(null),
    [targetId, setTargetId] = useState<string | null>(null),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [tab, setTab] = useState('planning'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [editConnections, setEditConnections] = useState(false),
    [showImports, setShowImports] = useState(false),
    [report, setReport] = useState<VerificationReport | null>(null),
    [undo, setUndo] = useState<PlanInput[]>([]),
    [redo, setRedo] = useState<PlanInput[]>([]);
  const [identities, setIdentities] = useState<
      (IdentityRecord & { candidateCount: number }) | null
    >(null),
    [canvasGeneration, setCanvasGeneration] = useState(0);
  const uiToken = useRef(''),
    viewRef = useRef<ViewState | null>(null),
    layoutQueue = useRef(Promise.resolve());
  const load = useCallback(async (planId?: string, seeds: string[] = []) => {
    const [
      summary,
      functions,
      annotations,
      groups,
      policies,
      plans,
      views,
      session,
    ] = await Promise.all([
      api<ProjectSummary>('/project'),
      api<FunctionResults>('/functions?limit=20'),
      api<Records<AnnotationRecord>>('/annotations'),
      api<Records<GroupRecord>>('/groups'),
      api<Records<FolderPolicy>>('/policies'),
      api<Records<PlanRevision>>('/plans'),
      api<Records<ViewState>>('/views'),
      api<{ approvalToken: string }>('/ui/session'),
    ]);
    const plan = planId
      ? PlanSchema.parse(await api(`/plans/${idPath(planId)}`))
      : null;
    const referenced =
      plan?.changes.flatMap((change) =>
        change.op === 'add_call'
          ? [change.source, change.target]
          : change.op === 'update_function' || change.op === 'delete_function'
            ? [change.functionId]
            : [],
      ) ?? [];
    const seedIds = [
      ...new Set([
        ...seeds,
        ...referenced.filter((id) => !id.startsWith('plan:')),
      ]),
    ].slice(0, 50);
    let graph: GraphData;
    try {
      graph = await api<GraphData>('/graph', 'POST', {
        seeds: seedIds.length
          ? seedIds
          : functions.items[0]
            ? [functions.items[0].id]
            : [],
        depth: 1,
        budget: 150,
      });
    } catch (failure) {
      if (!(failure instanceof ApiError) || failure.status !== 404)
        throw failure;
      graph = await api<GraphData>('/graph', 'POST', {
        seeds: [],
        depth: 0,
        budget: 100,
      });
      setMessage('部分规划端点已不在当前快照中；保留规划历史供核对。');
    }
    viewRef.current = views.items[0] ?? null;
    uiToken.current = session.approvalToken;
    setIdentities(
      await api<IdentityRecord & { candidateCount: number }>(
        '/identity?limit=50',
      ),
    );
    setWorkspace({
      summary,
      graph,
      annotations: annotations.items,
      groups: groups.items,
      policies: policies.items,
      plans: plans.items,
      view: viewRef.current,
    });
    setResults(functions);
    setActive(plan);
  }, []);
  useEffect(() => {
    void load().catch((failure) =>
      setError(failure instanceof Error ? failure.message : '无法连接 API'),
    );
  }, [load]);
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '操作失败');
      if (failure instanceof ApiError && failure.status === 409) {
        setMessage('版本或基线已变化，请检查当前内容后再操作。');
        if (active)
          try {
            setActive(
              PlanSchema.parse(await api(`/plans/${idPath(active.id)}`)),
            );
          } catch {
            /* Retain displayed input on a failed reload. */
          }
      }
      return false;
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => {
    void run(async () => {
      await api('/index/refresh', 'POST', {});
      await load(active?.id);
      setMessage('真实代码索引已刷新，知识与布局保留。');
    });
  };
  const selectPlan = (id: string) => {
    setUndo([]);
    setRedo([]);
    setReport(null);
    void run(async () => {
      await load(id || undefined);
    });
  };
  const savePlan = async (input: PlanInput, track = true) => {
    if (!active) return false;
    const previous = planInput(active);
    return run(async () => {
      const updated = PlanSchema.parse(
        await api(`/plans/${idPath(active.id)}`, 'PUT', {
          expectedRevision: active.revision,
          data: input,
        }),
      );
      if (track) {
        setUndo((items) => [...items, previous]);
        setRedo([]);
      }
      await load(updated.id);
      setMessage(`已保存规划 v${updated.revision}；需要重新校验和确认。`);
    });
  };
  const planAction = (action: string) => {
    if (!active) return;
    void run(async () => {
      if (action === 'approve') {
        if (
          !window.confirm(
            `确认「${active.title}」第 ${active.revision} 版？\n基线：${active.baselineSnapshotId}\n确认的是当前显示的函数、调用目标、文件路径与约束。`,
          )
        )
          return;
        await api(
          `/plans/${idPath(active.id)}/approve`,
          'POST',
          {
            expectedRevision: active.revision,
            semanticHash: active.semanticHash,
          },
          { 'x-atlasmode-ui-token': uiToken.current },
        );
        setMessage(`已人工确认规划 v${active.revision}。`);
      } else if (action === 'verify') {
        const verified = await api<VerificationReport>(
          `/plans/${idPath(active.id)}/verify`,
          'POST',
          {},
        );
        setReport(verified);
        setTab('verification');
        setMessage('已按真实源码核对；功能行为仍需测试。');
      } else if (action === 'cancel') {
        await api(`/plans/${idPath(active.id)}`, 'DELETE', {
          expectedRevision: active.revision,
        });
        setMessage('规划已取消，历史保留。');
      } else
        await api(`/plans/${idPath(active.id)}/${action}`, 'POST', {
          expectedRevision: active.revision,
        });
      await load(active.id);
    });
  };
  const historyAction = (direction: 'undo' | 'redo') => {
    if (!active) return;
    const stack = direction === 'undo' ? undo : redo,
      input = stack.at(-1);
    if (!input) return;
    const current = planInput(active);
    void savePlan(input, false).then((saved) => {
      if (!saved) return;
      if (direction === 'undo') {
        setUndo((items) => items.slice(0, -1));
        setRedo((items) => [...items, current]);
      } else {
        setRedo((items) => items.slice(0, -1));
        setUndo((items) => [...items, current]);
      }
    });
  };
  const onSelect = (id: string, kind: string) => {
    setTargetId(id);
    if (kind === 'function' && !id.startsWith('plan:'))
      void api<FunctionContext>(`/functions/${idPath(id)}?limit=100`)
        .then(setContext)
        .catch((failure) => setError(failure.message));
    else setContext(null);
  };
  const onSelection = useCallback(
    (ids: string[]) =>
      setSelectedIds((previous) =>
        previous.join('|') === ids.join('|') ? previous : ids,
      ),
    [],
  );
  const onLayout = (positions: ViewState['positions'], viewport?: Viewport) => {
    layoutQueue.current = layoutQueue.current
      .then(async () => {
        const previous = viewRef.current,
          data = {
            positions: { ...previous?.positions, ...positions },
            collapsed: previous?.collapsed ?? [],
            viewport: viewport ?? previous?.viewport ?? { x: 0, y: 0, zoom: 1 },
          };
        const saved = previous
          ? await api<ViewState>('/views/workspace', 'PUT', {
              expectedRevision: previous.revision,
              data,
            })
          : await api<ViewState>('/views', 'POST', data);
        viewRef.current = saved;
        setWorkspace((current) =>
          current ? { ...current, view: saved } : current,
        );
      })
      .catch((failure) =>
        setError(failure instanceof Error ? failure.message : '布局保存失败'),
      );
  };
  const onConnect = (connection: Connection, edge?: Edge) => {
    if (!active || !connection.source || !connection.target) return;
    const source = connection.source,
      target = connection.target;
    let changes: PlanChange[] = [...active.changes];
    if (edge) {
      const planned = changes.find(
        (change) => change.op === 'add_call' && change.id === edge.id,
      );
      if (planned?.op === 'add_call')
        changes = changes.map((change) =>
          change === planned ? { ...planned, source, target } : change,
        );
      else {
        if (
          !changes.some(
            (change) =>
              change.op === 'delete_relation' && change.relationId === edge.id,
          )
        )
          changes.push({ op: 'delete_relation', relationId: edge.id });
        changes.push({
          op: 'add_call',
          id: `plan:${crypto.randomUUID()}`,
          source,
          target,
        });
      }
    } else
      changes.push({
        op: 'add_call',
        id: `plan:${crypto.randomUUID()}`,
        source,
        target,
      });
    const old = active.changes.find(
      (change) => change.op === 'add_call' && change.id === edge?.id,
    );
    void savePlan({
      ...planInput(active),
      changes,
      requirements: active.requirements.map((item) =>
        old?.op === 'add_call' &&
        item.nodeId === old.source &&
        item.target === old.target
          ? { ...item, nodeId: source, target }
          : item,
      ),
    });
  };
  const deleteFunction = () => {
    if (!context || !workspace) return;
    const id = context.function.id;
    const incident = [...context.incoming, ...context.outgoing].filter(
      (relation) => relation.type !== 'contains',
    );
    if (!active) {
      void run(async () => {
        const created = PlanSchema.parse(
          await api('/plans', 'POST', {
            baselineSnapshotId: workspace.graph.snapshotId,
            title: '删除 ' + context.function.name,
            reason: '删除函数及其相关调用，保留人工复核',
            source: 'user',
            changes: [
              { op: 'delete_function', functionId: id },
              ...incident.map((relation) => ({
                op: 'delete_relation',
                relationId: relation.id,
              })),
            ],
            requirements: [],
          }),
        );
        setTab('planning');
        await load(created.id);
      });
      return;
    }
    void savePlan({
      ...planInput(active),
      changes: [
        ...active.changes.filter(
          (change) =>
            !(change.op === 'delete_function' && change.functionId === id),
        ),
        { op: 'delete_function', functionId: id },
        ...incident
          .filter(
            (relation) =>
              !active.changes.some(
                (change) =>
                  change.op === 'delete_relation' &&
                  change.relationId === relation.id,
              ),
          )
          .map((relation) => ({
            op: 'delete_relation' as const,
            relationId: relation.id,
          })),
      ],
    });
  };
  const modifyFunction = () => {
    if (!context || !workspace) return;
    const fn = context.function;
    if (!active) {
      void run(async () => {
        const created = PlanSchema.parse(
          await api('/plans', 'POST', {
            baselineSnapshotId: workspace.graph.snapshotId,
            title: '修改 ' + fn.name,
            reason: '调整已有函数接口或目标文件',
            source: 'user',
            changes: [
              {
                op: 'update_function',
                functionId: fn.id,
                name: fn.name,
                signature: fn.signature,
                filePath: context.file.path,
              },
            ],
            requirements: [],
          }),
        );
        setTab('planning');
        await load(created.id);
      });
      return;
    }
    void savePlan({
      ...planInput(active),
      changes: [
        ...active.changes.filter(
          (change) =>
            !(change.op === 'update_function' && change.functionId === fn.id),
        ),
        {
          op: 'update_function',
          functionId: fn.id,
          name: fn.name,
          signature: fn.signature,
          filePath: context.file.path,
        },
      ],
    });
  };
  const saveKnowledge = async (
    plural: string,
    data: unknown,
    record?: { id: string; revision: number },
  ) =>
    run(async () => {
      await api(
        record ? `/${plural}/${idPath(record.id)}` : `/${plural}`,
        record ? 'PUT' : 'POST',
        record ? { expectedRevision: record.revision, data } : data,
      );
      await load(active?.id);
      setMessage('知识记录已保存。');
    });
  const deleteKnowledge = async (
    plural: string,
    record: { id: string; revision: number },
  ) => {
    await run(async () => {
      await api(`/${plural}/${idPath(record.id)}`, 'DELETE', {
        expectedRevision: record.revision,
      });
      await load(active?.id);
      setMessage('记录已删除；源码未改变。');
    });
  };
  const exportKnowledge = () => {
    void run(async () => {
      const data = await api<KnowledgeExport>('/knowledge/export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atlasmode-knowledge.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('知识已导出；服务器也保存了可迁移副本。');
    });
  };
  const importKnowledge = (file: File) => {
    void run(async () => {
      const data: unknown = JSON.parse(await file.text());
      const preview = await api<{
        previewToken: string;
        conflicts: { id: string; currentRevision: number }[];
        counts: Record<string, number>;
      }>('/knowledge/import/preview', 'POST', data);
      const replace = preview.conflicts.length > 0;
      if (
        !window.confirm(
          `导入 ${Object.values(preview.counts).reduce((a, b) => a + b, 0)} 条知识记录？\n${replace ? `${preview.conflicts.length} 条与现有记录冲突；确认将明确替换这些记录：\n${preview.conflicts.map((item) => item.id).join('\n')}` : '未发现 ID 冲突。'}`,
        )
      )
        return;
      await api('/knowledge/import', 'POST', {
        data,
        previewToken: preview.previewToken,
        replaceConflicts: replace,
      });
      await load(active?.id);
      setMessage('已按预览导入知识。');
    });
  };
  const functions = [
    ...new Map(
      [
        ...(results?.items ?? []),
        ...(workspace?.graph.nodes.filter(
          (node): node is FunctionNode => node.kind === 'function',
        ) ?? []),
      ].map((fn) => [fn.id, fn]),
    ).values(),
  ];
  const visiblePlan =
    active && !['cancelled', 'verifying', 'completed'].includes(active.status)
      ? active
      : null;
  return (
    <main className="workspace-app">
      <header className="app-header">
        <div>
          <span className="eyebrow">真实代码 · 规划 · MCP</span>
          <h1>AtlasMode</h1>
        </div>
        <div className="actions">
          <span className="health">
            {workspace ? '真实索引已加载' : '正在连接本地服务'}
          </span>
          <button disabled={busy} onClick={refresh}>
            刷新真实索引
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button onClick={() => setError('')}>关闭</button>
        </div>
      )}
      {message && (
        <div role="status" className="message-banner">
          {message}
        </div>
      )}
      {!workspace ? (
        <section className="empty-state">
          <h2>加载授权目标仓库</h2>
          <p>启动时自动扫描并索引真实源码。请确保本地 API 已启动。</p>
          <button onClick={() => void run(() => load())}>重新连接</button>
        </section>
      ) : (
        <>
          <div className="snapshot-bar">
            <strong>来源：真实源码</strong>
            <span>
              {workspace.summary.counts.functions} 个函数 ·{' '}
              {workspace.summary.counts.files} 个文件 ·{' '}
              {workspace.summary.counts.unresolved} 个未知调用/导入
            </span>
            <code>{workspace.graph.snapshotId}</code>
            <details>
              <summary>索引覆盖与限制</summary>
              <p>
                Git：{workspace.summary.gitRevision ?? '未记录 Git revision'} ·
                文件内容摘要捕捉未提交修改。
              </p>
              {workspace.summary.scope.exclusions.map((item, index) => (
                <p key={index}>
                  <code>{item.path}</code> — {item.reason}
                </p>
              ))}
              <p>
                已指纹化的解析配置：
                {workspace.summary.scope.configuration.join(', ') || '无'}
              </p>
              {workspace.summary.scope.diagnostics.map((item, index) => (
                <p key={index}>{item}</p>
              ))}
            </details>
          </div>
          <div className="workspace-grid">
            <aside className="search-panel">
              <h2>函数搜索</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () =>
                    setResults(
                      await api<FunctionResults>(
                        `/functions?query=${encodeURIComponent(query)}&limit=20`,
                      ),
                    ),
                  );
                }}
              >
                <label>
                  名称或文件路径
                  <input
                    aria-label="函数搜索"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button disabled={busy}>搜索</button>
              </form>
              <p className="muted">{results?.total ?? 0} 条结果</p>
              <ul className="function-list">
                {results?.items.map((fn) => (
                  <li key={fn.id}>
                    <button
                      onClick={() => {
                        onSelect(fn.id, 'function');
                        void run(async () => {
                          const graph = await api<GraphData>('/graph', 'POST', {
                            seeds: [fn.id],
                            depth: 1,
                            budget: 150,
                          });
                          setWorkspace((current) =>
                            current ? { ...current, graph } : current,
                          );
                        });
                      }}
                    >
                      {fn.qualifiedName}
                      <small>
                        {fn.symbolKind} · L{fn.range.startLine}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button
                  disabled={busy || !results || results.offset === 0}
                  onClick={() =>
                    void run(async () =>
                      setResults(
                        await api<FunctionResults>(
                          `/functions?query=${encodeURIComponent(query)}&offset=${Math.max(0, (results?.offset ?? 0) - 20)}&limit=20`,
                        ),
                      ),
                    )
                  }
                >
                  上一页
                </button>
                <button
                  disabled={
                    busy ||
                    !results ||
                    results.offset + results.limit >= results.total
                  }
                  onClick={() =>
                    void run(async () =>
                      setResults(
                        await api<FunctionResults>(
                          `/functions?query=${encodeURIComponent(query)}&offset=${(results?.offset ?? 0) + 20}&limit=20`,
                        ),
                      ),
                    )
                  }
                >
                  下一页
                </button>
              </div>
              <h3>知识与备份</h3>
              <button disabled={busy} onClick={exportKnowledge}>
                导出知识
              </button>
              <label className="file-input">
                导入知识
                <input
                  aria-label="导入知识文件"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importKnowledge(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const backup = await api<{ filename: string }>(
                      '/storage/backup',
                      'POST',
                      {},
                    );
                    setMessage(`SQLite 备份已创建：${backup.filename}`);
                  })
                }
              >
                备份数据库
              </button>
            </aside>
            <section className="graph-section">
              <div className="graph-heading">
                <h2>代码事实与规划覆盖层</h2>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={showImports}
                    onChange={(event) => setShowImports(event.target.checked)}
                  />
                  显示导入
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    disabled={!visiblePlan}
                    checked={editConnections}
                    onChange={(event) =>
                      setEditConnections(event.target.checked)
                    }
                  />
                  编辑规划连线
                </label>
                <button
                  disabled={busy || !workspace.view}
                  onClick={() =>
                    void run(async () => {
                      await layoutQueue.current;
                      const current = viewRef.current;
                      if (current)
                        await api('/views/workspace', 'DELETE', {
                          expectedRevision: current.revision,
                        });
                      viewRef.current = null;
                      setWorkspace((previous) =>
                        previous ? { ...previous, view: null } : previous,
                      );
                      setCanvasGeneration((value) => value + 1);
                      setMessage('默认布局已恢复；规划确认不受影响。');
                    })
                  }
                >
                  重置布局
                </button>
              </div>
              <div className="legend">
                <span>真实代码</span>
                <span>规划新增/修改（虚线调用）</span>
                <span>知识说明（点线）</span>
                <small>拖动卡片只改变布局 · Shift 框选</small>
              </div>
              <CodeCanvas
                key={canvasGeneration}
                graph={workspace.graph}
                plan={visiblePlan}
                view={workspace.view}
                groups={workspace.groups}
                annotations={workspace.annotations}
                editConnections={editConnections}
                showImports={showImports}
                busy={busy}
                onSelect={onSelect}
                onSelection={onSelection}
                onLayout={onLayout}
                onConnect={onConnect}
              />
              {workspace.graph.truncated && (
                <p className="muted graph-notice">
                  当前子图达到节点预算；用函数搜索缩小范围或通过 MCP 分页展开。
                </p>
              )}
              <div className="context-panel">
                {identities && identities.candidateCount > 0 && (
                  <details>
                    <summary>
                      待确认的符号迁移候选（{identities.candidateCount}）
                    </summary>
                    {identities.candidates.map((candidate) => (
                      <div
                        className="change-card"
                        key={candidate.previous.id + candidate.candidate.id}
                      >
                        <p>
                          {candidate.previous.name} ·{' '}
                          {candidate.previous.filePath}
                          <br />→ {candidate.candidate.name} ·{' '}
                          {candidate.candidate.filePath}
                        </p>
                        <p>仅为静态结构候选，不会自动迁移注释或功能集。</p>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              if (
                                !window.confirm(
                                  '确认这是同一个逻辑函数，并将其注释和功能集成员绑定迁移到新符号？',
                                )
                              )
                                return;
                              await api(
                                '/identity/confirm',
                                'POST',
                                {
                                  previousId: candidate.previous.id,
                                  currentId: candidate.candidate.id,
                                  expectedRevision: identities.revision,
                                },
                                { 'x-atlasmode-ui-token': uiToken.current },
                              );
                              await load(active?.id);
                              setMessage('符号迁移映射已确认并持久化。');
                            })
                          }
                        >
                          确认迁移绑定
                        </button>
                      </div>
                    ))}
                  </details>
                )}
                {context ? (
                  <>
                    <h3>{context.function.qualifiedName}</h3>
                    <code>{context.function.signature}</code>
                    <p>
                      {context.file.path} : {context.function.range.startLine}–
                      {context.function.range.endLine}
                    </p>
                    <div className="actions">
                      <button disabled={busy} onClick={modifyFunction}>
                        规划修改此函数
                      </button>
                      <button disabled={busy} onClick={deleteFunction}>
                        规划删除此函数
                      </button>
                    </div>
                    <details open>
                      <summary>调用与未知证据</summary>
                      {context.outgoing.map((relation) => (
                        <p key={relation.id}>
                          <strong>{relation.expression}</strong> ·{' '}
                          {relation.resolution === 'unresolved'
                            ? `未知：${relation.reason}`
                            : '静态符号已解析'}{' '}
                          · L{relation.evidence?.range.startLine}
                        </p>
                      ))}
                      {context.truncated && (
                        <p>更多调用请通过有分页的 MCP 查询。</p>
                      )}
                    </details>
                  </>
                ) : (
                  <p>
                    选择函数查看签名、路径和调用证据。圈选成员不会移动源文件。
                  </p>
                )}
              </div>
            </section>
            <aside className="editing-panel">
              <nav aria-label="功能面板">
                {tabs.map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={tab === id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === 'planning' && (
                <PlanPanel
                  currentSnapshotId={workspace.graph.snapshotId}
                  plans={workspace.plans}
                  active={active}
                  functions={functions}
                  nodes={workspace.graph.nodes}
                  busy={busy}
                  onSelect={selectPlan}
                  onCreate={(input) =>
                    run(async () => {
                      const plan = PlanSchema.parse(
                        await api('/plans', 'POST', {
                          ...input,
                          baselineSnapshotId: workspace.graph.snapshotId,
                        }),
                      );
                      setUndo([]);
                      setRedo([]);
                      await load(plan.id);
                    })
                  }
                  onSave={savePlan}
                  onValidate={() => planAction('validate')}
                  onApprove={() => planAction('approve')}
                  onCancel={() => planAction('cancel')}
                  onVerify={() => planAction('verify')}
                  canUndo={undo.length > 0}
                  canRedo={redo.length > 0}
                  onUndo={() => historyAction('undo')}
                  onRedo={() => historyAction('redo')}
                />
              )}
              {tab === 'annotations' && (
                <AnnotationPanel
                  items={workspace.annotations}
                  targetId={targetId}
                  busy={busy}
                  onSave={(data, record) =>
                    saveKnowledge('annotations', data, record)
                  }
                  onDelete={(record) => deleteKnowledge('annotations', record)}
                />
              )}
              {tab === 'groups' && (
                <GroupPanel
                  items={workspace.groups}
                  selectedIds={selectedIds}
                  busy={busy}
                  onSave={(data, record) =>
                    saveKnowledge('groups', data, record)
                  }
                  onDelete={(record) => deleteKnowledge('groups', record)}
                  onShow={(ids) =>
                    void run(() => load(active?.id, ids.slice(0, 50)))
                  }
                />
              )}
              {tab === 'policies' && (
                <PolicyPanel
                  items={workspace.policies}
                  busy={busy}
                  onSave={(data, record) =>
                    saveKnowledge('policies', data, record)
                  }
                  onDelete={(record) => deleteKnowledge('policies', record)}
                />
              )}
              {tab === 'verification' && <VerificationPanel report={report} />}
            </aside>
          </div>
          <p className="footnote">
            单用户本地工作区。MCP
            与网页共享同一服务；没有内置模型密钥，也不会在确认前改写目标源码。
          </p>
        </>
      )}
    </main>
  );
}
