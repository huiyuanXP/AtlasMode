import { useState } from "react";
import { useStore } from "zustand";
import { useStrings } from "../i18n/index.js";
import { type Workspace } from "./workspace.js";
import { Canvas } from "../features/graph/Canvas.js";
import { Inspector } from "../features/graph/Inspector.js";
import { PlanningPanel } from "../features/planning/PlanningPanel.js";
import {
  reconnectRelation,
  temporaryId,
  type EdgeReference,
  type PlannedRelation,
} from "../features/planning/operations.js";
import { VerificationPanel } from "../features/verification/VerificationPanel.js";
import type { LayerFilter } from "../features/graph/projection.js";
import { Navigation } from "./Navigation.js";
export function WorkspacePanels({ app }: { app: Workspace }) {
  const zh = useStrings();
  const state = useStore(app.store),
    [tab, setTab] = useState<"source" | "plan" | "verify">("source"),
    [edge, setEdge] = useState<EdgeReference>(),
    [relationType, setRelationType] =
      useState<PlannedRelation["type"]>("calls");
  const { project, summary, plan, graph } = state;
  const busy = Object.values(state.busy).some(Boolean),
    planBusy =
      !!state.busy.plan || !!state.busy.project || !!state.busy.knowledge;
  const connect = (
    source: string,
    target: string,
    type: PlannedRelation["type"],
    edge?: EdgeReference,
  ) => {
    if (!plan || planBusy) return;
    const operations = edge
      ? reconnectRelation(
          plan.plan.operations,
          edge,
          source,
          target,
          type,
          temporaryId(),
        )
      : [
          ...plan.plan.operations,
          {
            kind: "add_relation" as const,
            id: temporaryId(),
            sourceId: source,
            targetId: target,
            type,
          },
        ];
    void app.savePlan(operations);
    setTab("plan");
  };
  const download = (content: string, name: string) => {
    const url = URL.createObjectURL(
      new Blob([content], {
        type: name.endsWith(".json") ? "application/json" : "text/markdown",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!project)
    return (
      <div className="welcome">
        <div className="welcome-symbol">⌘</div>
        <h1>{zh.empty}</h1>
        <p>{zh.emptyHint}</p>
        <small>{zh.noServer}</small>
      </div>
    );
  return (
    <main className="workspace">
      <Navigation app={app} onFocus={() => setTab("source")} />
      <section className="graph-area">
        <div className="graph-toolbar">
          <label>
            {zh.layers}
            <select
              value={state.filter}
              onChange={(e) =>
                app.store.setState({ filter: e.target.value as LayerFilter })
              }
            >
              <option value="both">{zh.both}</option>
              <option value="fact">{zh.fact}</option>
              <option value="plan">{zh.plan}</option>
            </select>
          </label>
          <label>
            {zh.relationType}
            <select
              disabled={!plan || planBusy}
              value={relationType}
              onChange={(e) =>
                setRelationType(e.target.value as PlannedRelation["type"])
              }
            >
              {(["calls", "must_call", "must_reuse"] as const).map((t) => (
                <option key={t} value={t}>
                  {zh[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="graph-hint">{zh.graphHelp}</div>
        {graph?.truncated && (
          <p className="warning graph-warning">{zh.truncated}</p>
        )}
        {((graph && summary && graph.snapshotId !== summary.snapshotId) ||
          (state.context &&
            summary &&
            state.context.snapshotId !== summary.snapshotId)) && (
          <p className="warning">{zh.graphStale}</p>
        )}
        <Canvas
          graph={graph}
          operations={plan?.plan.operations ?? []}
          view={state.view}
          filter={state.filter}
          focusRequest={state.focusRequest}
          canEdit={!!plan && !planBusy}
          relationType={relationType}
          onSelect={(n) => {
            void app.selectNode(n);
            setEdge(undefined);
            setTab("source");
          }}
          onExpand={(id) => void app.expand(id)}
          onLayout={(positions) => app.saveView({ ...state.view, positions })}
          onEdge={(e) => {
            setEdge(e);
            setTab("plan");
          }}
          onConnect={connect}
        />
        <footer>
          <span>{zh.bounded}</span>
          <span>{busy ? zh.working : zh.viewSaved}</span>
        </footer>
      </section>
      <aside className="inspector" aria-label={zh.inspector}>
        <nav className="tabs">
          {(["source", "plan", "verify"] as const).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "source"
                ? zh.sourceTab
                : t === "plan"
                  ? zh.planTab
                  : zh.verifyTab}
            </button>
          ))}
        </nav>
        <div className="inspector-scroll">
          {tab === "source" && (
            <Inspector
              key={state.selectedNode?.id ?? "none"}
              node={state.selectedNode}
              source={state.source}
              context={state.context}
              busy={!!state.busy.inspect}
              onPage={(offset) => {
                if (state.selectedNode)
                  void app.selectNode(state.selectedNode, offset);
              }}
              onExpand={(budget) => {
                if (state.selectedNode)
                  void app.expand(state.selectedNode.id, 1, budget);
              }}
            />
          )}
          {tab === "plan" && (
            <>
              <div className="button-row">
                <button
                  disabled={planBusy || !state.history?.past.length}
                  onClick={() => void app.undo()}
                >
                  {zh.undo}
                </button>
                <button
                  disabled={planBusy || !state.history?.future.length}
                  onClick={() => void app.redo()}
                >
                  {zh.redo}
                </button>
              </div>
              <p className="muted">{zh.historyHelp}</p>
              <PlanningPanel
                plans={state.plans}
                detail={plan}
                node={state.selectedNode}
                nodes={graph?.nodes ?? []}
                edge={edge}
                busy={planBusy || !summary}
                onChoose={(id) => {
                  setEdge(undefined);
                  void app.choosePlan(id);
                }}
                onCreate={(title) => void app.createPlan(title)}
                onSave={(ops, title, description) =>
                  void app.savePlan(ops, title, description)
                }
                onValidate={() => void app.validate()}
                onApprove={() => void app.approve()}
                onExport={(format) => void app.exportPlan(format, download)}
                onClearEdge={() => setEdge(undefined)}
              />
            </>
          )}
          {tab === "verify" && (
            <VerificationPanel
              report={state.report}
              disabled={!plan || planBusy}
              onVerify={() => void app.verify()}
            />
          )}
        </div>
      </aside>
    </main>
  );
}
