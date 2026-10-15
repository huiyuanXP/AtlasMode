import { structureLegacyPolicies } from "@codemap/core";
import type { PolicyDraft, PolicyPanelState } from "./policy-controller.js";
const en = {
  title: "Folder policies",
  help: "Edit directory purpose or legacy path rules. Descriptive metadata does not prove a dependency rule is satisfied.",
  reload: "Read structure again",
  accept: "Accept external conflict and read again",
  newPolicy: "New policy",
  newFolder: "New file folder",
  path: "Path prefix",
  purpose: "Purpose",
  forbidden: "Forbidden dependencies",
  save: "Save policy",
  preview: "Preview DB policy migration",
  import: "Import these DB policies into structure.json",
  metadata: "Read-only metadata",
  metadataHelp:
    "allowed / forbidden, dependencyRules and unknown fields are retained. This editor changes only path and purpose for a file folder.",
  noPolicies: "No policies",
  legacy: "Legacy path policies",
  folders: "structure.json folders",
  waiting: "Read current structure before saving.",
  saved: "Saved. Read again before another edit.",
  retry: "Retry the exact request",
  migrationHelp:
    "Preview first. Import is explicit and invalidates current approval; historical approvals remain recorded.",
  noMigration: "No DB-only policies to migrate.",
  unknown:
    "Request outcome is uncertain; retry the same request or explicitly read again before editing.",
  status: "Structure status",
  digest: "File digest",
  verified: "Verified",
  choose: "Edit policy",
  create: "Create a missing structure.json by saving a policy or file folder.",
  sync: "Shared workspace synchronization is pending integration.",
  dbSource: "Database policy; not migrated",
  fileSource: "File extension policy",
  machine: "Existing target-path checks",
  purposeHelp: "Purpose description; requires human judgment",
  ruleHelp: "Import constraints synchronized; checks not executed",
  oldCopy: "Last valid copy; not current",
};
const zh: typeof en = {
  title: "目录策略",
  help: "编辑目录用途或旧路径规则。描述性元数据不能证明依赖规则已满足。",
  reload: "重新读取结构",
  accept: "接受外部冲突并重新读取",
  newPolicy: "新建策略",
  newFolder: "新建文件目录",
  path: "路径前缀",
  purpose: "用途",
  forbidden: "禁止依赖",
  save: "保存策略",
  preview: "预览数据库策略迁移",
  import: "将这些数据库策略导入 structure.json",
  metadata: "只读元数据",
  metadataHelp:
    "allowed / forbidden、dependencyRules 和未知字段均保留。文件目录编辑只修改路径和用途。",
  noPolicies: "暂无策略",
  legacy: "旧路径策略",
  folders: "structure.json 目录",
  waiting: "保存前请读取当前结构。",
  saved: "已保存。再次编辑前请重新读取。",
  retry: "重试原请求",
  migrationHelp: "先预览，再显式导入。导入会使当前批准失效，历史批准仍保留。",
  noMigration: "没有待迁移的数据库策略。",
  unknown: "请求结果尚未确定；请重试同一请求，或显式重新读取后再编辑。",
  status: "结构状态",
  digest: "文件摘要",
  verified: "校验时间",
  choose: "编辑策略",
  create: "保存策略或文件目录可创建缺失的 structure.json。",
  sync: "共享工作区同步尚待接线。",
  dbSource: "数据库策略，尚未迁移",
  fileSource: "文件扩展策略",
  machine: "禁止目标路径（现有程序检查）",
  purposeHelp: "职责说明，待人工判断",
  ruleHelp: "导入约束已同步，尚未执行检查",
  oldCopy: "旧有效副本，非当前数据",
};
export type StructurePolicyPanelProps = {
  state: PolicyPanelState;
  locale: "en" | "zh";
  integrated?: boolean;
  onReload: () => void;
  onConflictRead: () => void;
  onChoose: (selection: string) => void;
  onEdit: (
    patch: Partial<Pick<PolicyDraft, "path" | "purpose" | "forbidden">>,
  ) => void;
  onSave: () => void;
  onRetry: () => void;
  onPreview: () => void;
  onImport: () => void;
};
/** Pure view with explicit commands; unknown/schema content is always escaped text. */
export function StructurePolicyPanel({
  state: s,
  locale,
  integrated = false,
  ...actions
}: StructurePolicyPanelProps) {
  const t = locale === "zh" ? zh : en,
    d = s.draft,
    doc = s.snapshot?.document ?? s.snapshot?.lastGood?.document;
  const fileIds = new Set(
    doc ? structureLegacyPolicies(doc).map((p) => p.id) : [],
  );
  const disabled = s.busy || s.retryAvailable,
    canSave =
      !!s.capture &&
      (s.snapshot?.status === "ready" || s.snapshot?.status === "missing") &&
      !s.needsReload &&
      !s.busy &&
      !s.retryAvailable;
  const selection =
    d.kind === "folder"
      ? d.previousPath === undefined
        ? "new-folder"
        : `folder:${d.previousPath}`
      : d.id
        ? `legacy:${d.id}`
        : "new-policy";
  return (
    <section className="knowledge-panel" aria-busy={s.busy}>
      <h2>{t.title}</h2>
      <p>
        <code>.codemap/structure.json</code> · schema v1
      </p>
      <p className="muted">{t.help}</p>
      <button data-action="reload" disabled={s.busy} onClick={actions.onReload}>
        {t.reload}
      </button>
      {s.snapshot?.status === "conflict" && (
        <button
          data-action="accept-conflict"
          disabled={s.busy}
          onClick={actions.onConflictRead}
        >
          {t.accept}
        </button>
      )}
      {s.snapshot && (
        <p>
          {t.status}: {s.snapshot.status} · r{s.snapshot.structureRevision}
          <br />
          {t.digest}: <code>{s.snapshot.fileDigest ?? "∅"}</code>
          <br />
          {t.verified}: {s.snapshot.verifiedAt}
        </p>
      )}
      {s.snapshot?.status === "missing" && <p>{t.create}</p>}
      {s.error && (
        <p role="alert">
          <strong>{s.error.code}</strong>: {s.error.message}
        </p>
      )}
      {s.snapshot?.diagnostics.map((issue, i) => (
        <p role="alert" key={i}>
          <code>{issue.pointer}</code>: {issue.message}
        </p>
      ))}
      {s.needsReload && (
        <p role="status">{s.notice === "saved" ? t.saved : t.waiting}</p>
      )}
      {s.notice === "saved" && !integrated && <p role="status">{t.sync}</p>}
      {s.retryAvailable && (
        <>
          <p>{t.unknown}</p>
          <button
            data-action="retry"
            disabled={s.busy}
            onClick={actions.onRetry}
          >
            {t.retry}
          </button>
        </>
      )}
      <div>
        <button
          data-action="new-policy"
          disabled={disabled}
          onClick={() => actions.onChoose("new-policy")}
        >
          {t.newPolicy}
        </button>
        <button
          data-action="new-folder"
          disabled={disabled}
          onClick={() => actions.onChoose("new-folder")}
        >
          {t.newFolder}
        </button>
      </div>
      <label>
        {t.choose}
        <select
          aria-label={t.choose}
          disabled={disabled}
          value={selection}
          onChange={(e) => actions.onChoose(e.target.value)}
        >
          <option value="new-policy">{t.newPolicy}</option>
          <option value="new-folder">{t.newFolder}</option>
          {doc?.folders.map((f) => (
            <option key={`folder:${f.path}`} value={`folder:${f.path}`}>
              {f.path || "."} · {f.purpose}
            </option>
          ))}
          {s.policies.map((p) => (
            <option key={`legacy:${p.id}`} value={`legacy:${p.id}`}>
              {p.pathPrefix || "."} · {p.purpose}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          actions.onSave();
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            {t.path}
            <input
              aria-label={t.path}
              placeholder="src/"
              value={d.path}
              onChange={(e) => actions.onEdit({ path: e.target.value })}
            />
          </label>
          <label>
            {t.purpose}
            <textarea
              aria-label={t.purpose}
              required
              value={d.purpose}
              onChange={(e) => actions.onEdit({ purpose: e.target.value })}
            />
          </label>
          {d.kind === "legacy" && (
            <label>
              {t.forbidden}
              <textarea
                aria-label={t.forbidden}
                placeholder="src/internal"
                value={d.forbidden}
                onChange={(e) => actions.onEdit({ forbidden: e.target.value })}
              />
            </label>
          )}
          <button data-action="save" disabled={!canSave}>
            {t.save}
          </button>
        </fieldset>
      </form>
      <h3>{t.legacy}</h3>
      {!s.policies.length && <p>{t.noPolicies}</p>}
      {s.policies.map((p) => (
        <article key={p.id}>
          <strong>{p.pathPrefix || "."}</strong>
          <p>{p.purpose}</p>
          <small>
            {fileIds.has(p.id) ? t.fileSource : t.dbSource} · {t.machine}
          </small>
          <br />
          <small>{t.forbidden}</small>
          <ul>
            {p.forbiddenDependencies.map((path, i) => (
              <li key={i}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        </article>
      ))}
      <h3>{t.folders}</h3>
      <p className="muted">{t.purposeHelp}</p>
      {doc?.folders.map((f) => (
        <article key={f.path}>
          <strong>{f.path || "."}</strong>
          <p>{f.purpose}</p>
        </article>
      ))}
      <details>
        <summary>{t.metadata}</summary>
        <p>{t.metadataHelp}</p>
        <p>{t.ruleHelp}</p>
        {!s.snapshot?.document && s.snapshot?.lastGood && <p>{t.oldCopy}</p>}
        <pre>{doc ? JSON.stringify(doc, null, 2) : "∅"}</pre>
      </details>
      <p>{t.migrationHelp}</p>
      <button
        data-action="preview"
        disabled={!canSave}
        onClick={actions.onPreview}
      >
        {t.preview}
      </button>
      {s.preview && (
        <div>
          <ul>
            {s.preview.policies.map((p) => (
              <li key={p.id}>
                {p.pathPrefix || "."} · {p.purpose} <code>{p.id}</code>
              </li>
            ))}
          </ul>
          {s.preview.policies.length ? (
            <button
              data-action="import"
              disabled={!canSave}
              onClick={actions.onImport}
            >
              {t.import}
            </button>
          ) : (
            <p>{t.noMigration}</p>
          )}
        </div>
      )}
    </section>
  );
}
