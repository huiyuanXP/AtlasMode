import { useState } from "react";
import { useStore } from "zustand";
import type { DirectoryPolicy } from "@codemap/core";
import type { Workspace } from "../../app/workspace.js";
import { useStrings } from "../../i18n/index.js";
export function PoliciesPanel({ app }: { app: Workspace }) {
  const state = useStore(app.store),
    text = useStrings();
  const [selected, setSelected] = useState("");
  const policy = state.policies.find((p) => p.id === selected);
  return (
    <section className="knowledge-panel">
      <h2>{text.policies}</h2>
      <p className="muted">{text.policyHelp}</p>
      <p className="muted">{text.knowledgeImpact}</p>
      <select
        aria-label={text.policies}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">{text.newPolicy}</option>
        {state.policies.map((p) => (
          <option key={p.id} value={p.id}>
            {p.pathPrefix || "."} · {p.purpose}
          </option>
        ))}
      </select>
      <PolicyForm
        key={JSON.stringify(policy) ?? "new"}
        policy={policy}
        busy={
          !!state.busy.knowledge || !!state.busy.project || !!state.busy.plan
        }
        onSave={(input) => void app.savePolicy(input)}
      />
      {!state.policies.length && <p>{text.noPolicies}</p>}
      {state.policies.map((p) => (
        <article key={p.id}>
          <strong>{p.pathPrefix || "."}</strong>
          <p>{p.purpose}</p>
          <small>{text.forbiddenDependencies}</small>
          <ul>
            {p.forbiddenDependencies.map((path, i) => (
              <li key={i}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
function PolicyForm({
  policy,
  busy,
  onSave,
}: {
  policy?: DirectoryPolicy;
  busy: boolean;
  onSave: (
    input: Omit<DirectoryPolicy, "id" | "projectId"> & { id?: string },
  ) => void;
}) {
  const text = useStrings(),
    [pathPrefix, setPath] = useState(policy?.pathPrefix ?? ""),
    [purpose, setPurpose] = useState(policy?.purpose ?? ""),
    [forbidden, setForbidden] = useState(
      policy?.forbiddenDependencies.join("\n") ?? "",
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...(policy ? { id: policy.id } : {}),
          pathPrefix,
          purpose,
          forbiddenDependencies: forbidden
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
    >
      <fieldset disabled={busy}>
        <label>
          {text.pathPrefix}
          <input
            placeholder="src/"
            value={pathPrefix}
            onChange={(e) => setPath(e.target.value)}
          />
        </label>
        <label>
          {text.purpose}
          <textarea
            aria-label={text.purpose}
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <label>
          {text.forbiddenDependencies}
          <textarea
            aria-label={text.forbiddenDependencies}
            placeholder="src/internal"
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
          />
        </label>
        <button>{text.savePolicy}</button>
      </fieldset>
    </form>
  );
}
