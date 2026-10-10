import { useStore } from "zustand";
import type { Workspace } from "../../app/workspace.js";
import "./groups.css";
import { useStrings } from "../../i18n/index.js";
export function GroupsPanel({ app }: { app: Workspace }) {
  const state = useStore(app.store),
    text = useStrings();
  const draft = state.groupDraft;
  const known = new Map(
    [
      ...(state.summary?.entrypoints ?? []),
      ...(state.search?.snapshotId === state.summary?.snapshotId
        ? (state.search?.items ?? [])
        : []),
      ...(state.graph?.snapshotId === state.summary?.snapshotId
        ? (state.graph?.nodes ?? [])
        : []),
      ...state.groupSelection,
      ...(state.memberPage?.snapshotId === state.summary?.snapshotId
        ? (state.memberPage?.bindings.flatMap((binding) =>
            binding.status === "bound" ? [binding.node] : [],
          ) ?? [])
        : []),
    ]
      .filter((n) => n.kind === "function")
      .map((n) => [n.id, n]),
  );
  const candidates = [...known.values()];
  const missing = new Set(
    state.memberPage?.snapshotId === state.summary?.snapshotId
      ? state.memberPage?.bindings
          .filter((binding) => binding.status === "missing")
          .map((binding) => binding.id)
      : [],
  );
  const busy =
    !!state.busy.knowledge || !!state.busy.project || !!state.busy.plan;
  return (
    <section className="knowledge-panel">
      <h2>{text.groups}</h2>
      <p className="muted">{text.groupHelp}</p>
      <p className="muted">{text.knowledgeImpact}</p>
      {!draft && (
        <button type="button" onClick={app.startGroup} disabled={busy}>
          {text.createGroup}
        </button>
      )}
      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void app.saveGroup(draft);
          }}
        >
          <fieldset disabled={busy}>
            <h3>{draft.id ? text.editGroup : text.createGroup}</h3>
            <label>
              {text.groupTitle}
              <input
                required
                value={draft.title}
                onChange={(e) =>
                  app.updateGroupDraft({ title: e.target.value })
                }
              />
            </label>
            <label>
              {text.groupDescription}
              <textarea
                value={draft.description}
                onChange={(e) =>
                  app.updateGroupDraft({ description: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              disabled={!state.groupSelection.length}
              onClick={app.addGroupSelection}
            >
              {text.addCircleSelection}
            </button>
            <p className="muted">
              {text.selectedMembers}: {draft.memberIds.length}
            </p>
            <ul className="group-members draft-members">
              {draft.memberIds.map((id) => (
                <li className="draft-member" key={id}>
                  <span>
                    {known.get(id)?.name ?? text.unloaded}
                    <code>{known.get(id)?.filePath ?? id}</code>
                    {missing?.has(id) && (
                      <span className="warning">
                        {text.removeMissingMember}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={text.removeMember}
                    onClick={() => app.removeGroupMember(id)}
                  >
                    {text.removeMember}
                  </button>
                </li>
              ))}
            </ul>
            <details>
              <summary>{text.chooseMembers}</summary>
              <div className="member-choices">
                {candidates.map((n) => (
                  <label className="check-row" key={n.id}>
                    <input
                      type="checkbox"
                      checked={draft.memberIds.includes(n.id)}
                      onChange={(e) =>
                        e.target.checked
                          ? app.updateGroupDraft({
                              memberIds: [
                                ...new Set([...draft.memberIds, n.id]),
                              ],
                            })
                          : app.removeGroupMember(n.id)
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
            <div className="button-row">
              <button
                disabled={
                  !draft.memberIds.length ||
                  draft.memberIds.some((id) => missing?.has(id))
                }
              >
                {draft.id ? text.saveGroup : text.createGroup}
              </button>
              <button type="button" onClick={app.cancelGroupDraft}>
                {text.cancelGroup}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!state.groups.length && <p>{text.noGroups}</p>}
      {state.groups.map((group) => (
        <article className="group" key={group.id}>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
          <small>
            {text[group.source]} · {text.members}: {group.memberIds.length}
          </small>
          <button
            type="button"
            onClick={() => app.editGroup(group)}
            disabled={busy}
          >
            {text.editGroup}
          </button>
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
                          {text.error}:{" "}
                          {binding.messageKey
                            ? text[binding.messageKey]
                            : binding.message}
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
