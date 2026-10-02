import { useState } from "react";
import { useStore } from "zustand";
import type { CodeNode } from "@codemap/core";
import type { Workspace } from "../../app/workspace.js";
import { useStrings } from "../../i18n/index.js";
export function GroupsPanel({ app }: { app: Workspace }) {
  const state = useStore(app.store),
    text = useStrings();
  const [selected, setSelected] = useState<Record<string, CodeNode>>({}),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState("");
  const candidates = [
    ...new Map(
      [
        ...(state.summary?.entrypoints ?? []),
        ...(state.search?.items ?? []),
        ...(state.graph?.nodes ?? []),
        ...Object.values(selected),
      ]
        .filter((n) => n.kind === "function")
        .map((n) => [n.id, n]),
    ).values(),
  ];
  const busy =
    !!state.busy.knowledge || !!state.busy.project || !!state.busy.plan;
  return (
    <section className="knowledge-panel">
      <h2>{text.groups}</h2>
      <p className="muted">{text.groupHelp}</p>
      <p className="muted">{text.knowledgeImpact}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void app.saveGroup({
            title,
            description,
            source: "user",
            memberIds: Object.keys(selected),
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {text.groupTitle}
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {text.groupDescription}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <details>
            <summary>
              {text.selectedMembers} ({Object.keys(selected).length})
            </summary>
            <div className="member-choices">
              {candidates.map((n) => (
                <label className="check-row" key={n.id}>
                  <input
                    type="checkbox"
                    checked={!!selected[n.id]}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (e.target.checked) next[n.id] = n;
                        else delete next[n.id];
                        return next;
                      })
                    }
                  />
                  <span>
                    {n.name}
                    <small>{n.filePath}</small>
                  </span>
                </label>
              ))}
            </div>
          </details>
          <button disabled={!Object.keys(selected).length}>
            {text.createGroup}
          </button>
        </fieldset>
      </form>
      {!state.groups.length && <p>{text.noGroups}</p>}
      {state.groups.map((group) => (
        <article className="group" key={group.id}>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
          <small>
            {text[group.source]} · {text.members}: {group.memberIds.length}
          </small>
          <button
            onClick={() => void app.loadMembers(group.id)}
            disabled={!!state.busy.project}
          >
            {text.members}
          </button>
          {state.memberPage?.groupId === group.id && (
            <>
              <p>
                {state.memberPage.offset + 1}–
                {Math.min(group.memberIds.length, state.memberPage.offset + 20)}{" "}
                / {group.memberIds.length}
              </p>
              {state.busy.members ? (
                <p role="status">{text.loading}</p>
              ) : (
                <ul className="group-members">
                  {state.memberPage.bindings.map((binding) => (
                    <li key={binding.id}>
                      {binding.status === "bound" ? (
                        <>
                          <strong>{binding.node.name}</strong>
                          <code>{binding.node.filePath}</code>
                        </>
                      ) : binding.status === "missing" ? (
                        <span className="warning">
                          {text.unbound}: <code>{binding.id}</code>
                        </span>
                      ) : (
                        <span className="error">
                          {text.error}: {binding.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="button-row">
                <button
                  disabled={
                    !!state.busy.members || state.memberPage.offset === 0
                  }
                  onClick={() =>
                    void app.loadMembers(
                      group.id,
                      Math.max(0, state.memberPage!.offset - 20),
                    )
                  }
                >
                  {text.previous}
                </button>
                <button
                  disabled={
                    !!state.busy.members ||
                    state.memberPage.offset + 20 >= group.memberIds.length
                  }
                  onClick={() =>
                    void app.loadMembers(
                      group.id,
                      state.memberPage!.offset + 20,
                    )
                  }
                >
                  {text.next}
                </button>
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
