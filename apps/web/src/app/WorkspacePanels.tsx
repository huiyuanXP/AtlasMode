import { WorkspaceAnnotationsPanel } from "../features/annotations/WorkspaceAnnotationsPanel.js";
import { useMemo, useState } from "react";
import type { Operation } from "@codemap/core";
import { useStore } from "zustand";
import { useStrings } from "../i18n/index.js";
import { type Workspace, type WorkspaceState } from "./workspace.js";
import { Canvas } from "../features/graph/Canvas.js";
import { InspectionCard } from "../features/graph/InspectionCard.js";
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
import { ChatPanel } from "../features/chat/ChatPanel.js";
import type { ChatSessions } from "../features/chat/sessions.js";
import type { ChatContext } from "../features/chat/types.js";
import { PendingPlans } from "../features/planning/PendingPlans.js";
import { PlanOverview } from "../features/planning/PlanOverview.js";
import { Breadcrumbs } from "../features/navigation/Breadcrumbs.js";
const emptyOperations: Operation[] = [];
/** Only already-loaded facts from the current project snapshot become candidates. */
export function planningCandidates(
  state: Pick<WorkspaceState, "summary" | "graph" | "search">,
) {
  const snapshotId = state.summary?.snapshotId;
  return [
    ...new Map(
      [
        ...(state.summary?.entrypoints ?? []),
        ...(state.search?.snapshotId === snapshotId
          ? (state.search?.items ?? [])
          : []),
        ...(state.graph?.snapshotId === snapshotId
          ? (state.graph?.nodes ?? [])
          : []),
      ]
        .filter((n) => n.kind === "function")
        .map((n) => [n.id, n]),
    ).values(),
  ];
}
export function WorkspacePanels({
  app,
  chatSessions,
  onOpenProject,
}: {
  app: Workspace;
  chatSessions: ChatSessions;
  onOpenProject: () => void;
}) {
  const zh = useStrings();
  const ownership = useStore(app.ownership.store);
  const annotations = useStore(app.annotations.store);
  const state = useStore(app.store),
    [tab, setTab] = useState<
      "chat" | "source" | "plan" | "verify" | "annotations"
    >("chat"),
    [planningChatOpen, setPlanningChatOpen] = useState(false),
    [edge, setEdge] = useState<EdgeReference>(),
    [relationType, setRelationType] =
      useState<PlannedRelation["type"]>("calls");
  const { project, summary, plan, graph } = state;
  const candidates = useMemo(
    () => planningCandidates(state),
    [state.summary, state.graph, state.search],
  );
  const busy = Object.values(state.busy).some(Boolean),
    planBusy =
      !!state.busy.plan || !!state.busy.project || !!state.busy.knowledge;
  const capture = app.capturePlan();
  const ownershipReady =
    !!capture &&
    !!plan &&
    plan.plan.status !== "stale" &&
    plan.plan.baselineSnapshotId === capture.snapshotId &&
    plan.plan.baselineContentHash === capture.snapshotHash &&
    !planBusy &&
    !state.dirtyPlanEditor &&
    !state.groupSelectionMode &&
    !state.groupDraft;
  const draftBlocked = state.dirtyPlanEditor || !!ownership.intent;
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
  const chatContext = (): ChatContext => {
    const current = app.store.getState(),
      node = current.selectedNode,
      location = current.navigationLocation;
    return {
      ...(current.summary ? { snapshotId: current.summary.snapshotId } : {}),
      ...(current.plan
        ? {
            planId: current.plan.plan.id,
            expectedRevision: current.plan.plan.revision,
          }
        : {}),
      ...(node?.kind === "function" ? { nodeId: node.id } : {}),
      ...(location
        ? { scope: { kind: location.kind, path: location.path } }
        : node?.filePath &&
            (node.kind === "function" ||
              node.kind === "file" ||
              node.kind === "folder")
          ? {
              scope: {
                kind: node.kind,
                path: node.filePath,
                ...(node.kind === "function" ? { nodeId: node.id } : {}),
              },
            }
          : {}),
    };
  };
  const onSend = () => {
    const token = app.captureAgentSync();
    return async ({
      run,
    }: {
      run?: import("../features/chat/types.js").ChatRun;
    }) => {
      await app.syncAgentChanges(run?.changedPlanIds ?? [], token);
    };
  };
  if (!project)
    return (
      <div className="welcome">
        <div className="welcome-symbol">⌘</div>
        <h1>{zh.empty}</h1>
        <p>{zh.emptyHint}</p>
        <button className="primary" type="button" onClick={onOpenProject}>
          {zh.welcomeOpenProject}
        </button>
        <p className="welcome-flow">{zh.welcomeFlow}</p>
      </div>
    );
  return (
    <main className="workspace">
      <Navigation
        app={app}
        chatSessions={chatSessions}
        context={chatContext}
        onSend={onSend}
        onFocus={() => setEdge(undefined)}
      />
      <section className="graph-area">
        <Breadcrumbs
          project={project}
          node={state.selectedNode}
          location={
            state.navigationLocation ??
            (state.selectedNode &&
            plan?.plan.operations.some(
              (o) =>
                o.kind === "add_function" &&
                o.tempId === state.selectedNode?.id,
            )
              ? {
                  path: state.selectedNode.filePath ?? ".",
                  kind: "file",
                  planned: true,
                }
              : undefined)
          }
          label={zh.location}
          plannedLabel={zh.plannedContext}
          scopeLabel={
            !state.selectedNode &&
            !state.navigationLocation &&
            plan &&
            state.focusRequest?.nodeIds?.length
              ? `${plan.plan.title} · ${zh.affectedObjects} ${state.focusRequest.nodeIds.length}`
              : undefined
          }
          onScope={(path, kind) => {
            void app.navigateScope(path, kind);
            setEdge(undefined);
          }}
          onFunction={(node) => {
            void app.focus(node);
            setEdge(undefined);
          }}
        />
        <div className="graph-toolbar">
          <div className="button-row" aria-label={zh.ownershipMode}>
            <button
              type="button"
              aria-pressed={ownership.mode === "layout"}
              disabled={ownership.status === "saving"}
              onClick={() => void app.ownership.setMode("layout")}
            >
              {zh.ownershipLayout}
            </button>
            <button
              type="button"
              aria-pressed={ownership.mode === "ownership"}
              disabled={!ownershipReady || ownership.status === "saving"}
              onClick={() => void app.ownership.setMode("ownership")}
            >
              {zh.ownershipMode}
            </button>
          </div>
          <button
            type="button"
            aria-pressed={state.groupSelectionMode}
            disabled={!!state.busy.project || ownership.mode === "ownership"}
            onClick={() => app.setGroupSelectionMode(!state.groupSelectionMode)}
          >
            {state.groupSelectionMode
              ? zh.finishCircleSelection
              : zh.circleSelect}
          </button>
          {state.groupSelectionMode && (
            <span role="status">
              {zh.circleSelectionHelp} · {state.groupSelection.length}
            </span>
          )}
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
              disabled={!plan || planBusy || annotations.executionBlocked}
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
          projectId={project.id}
          selectedNodeId={state.selectedNode?.id}
          groups={state.groups}
          ownershipMode={ownership.mode === "ownership"}
          ownershipEnabled={ownershipReady}
          onOwnershipStart={app.beginOwnership}
          onOwnershipEnd={app.ownership.endDrag}
          onOwnershipDrop={(node, nonce) => {
            if (
              (node.kind === "file" || node.kind === "folder") &&
              node.filePath
            )
              app.ownership.choose(
                { kind: node.kind, path: node.filePath, id: node.id },
                nonce,
              );
          }}
          onToggleGroup={app.toggleGroupCollapse}
          groupSelectionMode={state.groupSelectionMode}
          groupSelectionIds={state.groupSelection.map((n) => n.id)}
          onGroupSelection={app.setGroupSelection}
          relationPreviewId={state.relationPreviewId}
          fixedOperationRelationId={state.fixedOperationRelationId}
          previewRelation={[
            ...(state.context?.incoming ?? []),
            ...(state.context?.outgoing ?? []),
            ...(state.fileContext?.incoming ?? []),
            ...(state.fileContext?.outgoing ?? []),
            ...(state.fileContext?.imports ?? []),
            ...(state.fileContext?.unknown ?? []),
            ...(graph?.relations ?? []),
          ].find((r) => r.id === state.relationPreviewId)}
          previewNodes={[
            ...(graph?.nodes ?? []),
            ...(state.context?.relatedNodes ?? []),
            ...(state.fileContext?.relatedNodes ?? []),
          ]}
          onPreviewRelation={app.previewRelation}
          onCloseInspection={app.closeInspection}
          inspection={
            state.detailsOpen && state.selectedNode ? (
              <InspectionCard
                key={state.selectedNode.id}
                node={state.selectedNode}
                locale={state.view.locale}
                context={state.context}
                fileContext={state.fileContext}
                relatedNodes={candidates}
                operations={plan?.plan.operations ?? emptyOperations}
                planned={
                  !!plan?.plan.operations.some(
                    (o) =>
                      o.kind === "add_function" &&
                      o.tempId === state.selectedNode?.id,
                  )
                }
                busy={!!state.busy.inspect || !!state.busy.source}
                previewId={state.relationPreviewId}
                source={state.source}
                error={state.error}
                onClose={app.closeInspection}
                onPage={(offset) => void app.pageInspection(offset)}
                onJump={(id) => void app.jumpToNode(id)}
                onPreview={app.previewRelation}
                onSource={() => void app.loadSource()}
              />
            ) : undefined
          }
          referenceNodes={candidates}
          operations={plan?.plan.operations ?? emptyOperations}
          view={state.view}
          filter={state.filter}
          focusRequest={state.focusRequest}
          funnel={state.funnel}
          funnelPending={!!state.busy.funnel}
          onFunnel={(node) => {
            void app.enterFunnel(node);
            setEdge(undefined);
          }}
          onExitFunnel={app.exitFunnel}
          canEdit={!!plan && !planBusy && ownership.mode !== "ownership"}
          relationType={relationType}
          onSelect={(n) => {
            if (n.kind === "folder")
              void app.navigateScope(n.filePath ?? ".", n.kind);
            else void app.inspectNode(n);
            setEdge(undefined);
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
        <PendingPlans
          key={project.id}
          plans={state.plans}
          locale={state.view.locale}
          busy={planBusy}
          onChoose={(id) => {
            setTab("chat");
            setEdge(undefined);
            app.closeInspection();
            void app.choosePlan(id);
          }}
          onChat={() => {
            setTab("chat");
            setPlanningChatOpen(true);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLTextAreaElement>(".planning-chat textarea")
                ?.focus(),
            );
          }}
        />
        {annotations.executionBlocked && tab !== "annotations" && (
          <div role="status">
            <p>{zh.annotationExecutionBlocked}</p>
            <button type="button" onClick={() => setTab("annotations")}>
              {zh.annotationRecover}
            </button>
          </div>
        )}
        <nav className="tabs">
          {tab !== "chat" && (
            <button onClick={() => setTab("chat")}>{zh.backToChat}</button>
          )}
          <button
            aria-pressed={tab === "source"}
            disabled={!state.selectedNode && !state.navigationLocation}
            onClick={() => {
              setTab("source");
              void app.loadSource();
            }}
          >
            {zh.viewSource}
          </button>
          <button aria-pressed={tab === "plan"} onClick={() => setTab("plan")}>
            {zh.advancedEditing}
          </button>
          <button
            aria-pressed={tab === "verify"}
            onClick={() => setTab("verify")}
          >
            {zh.verifyTab}
          </button>
          <button
            type="button"
            aria-pressed={tab === "annotations"}
            onClick={() => setTab("annotations")}
          >
            {zh.annotationsTab}
          </button>
        </nav>
        <div className="inspector-scroll">
          {tab === "chat" && (
            <PlanOverview
              plans={state.plans}
              detail={plan}
              nodes={candidates}
              busy={planBusy || draftBlocked || annotations.executionBlocked}
              canUndo={!!state.history?.past.length}
              canRedo={!!state.history?.future.length}
              onChoose={(id) => {
                setEdge(undefined);
                void app.choosePlan(id);
              }}
              onOperation={(operation) => {
                setEdge(undefined);
                void app.focusOperation(operation);
              }}
              onUndo={() => void app.undo()}
              onRedo={() => void app.redo()}
              onValidate={() => void app.validate()}
              onApprove={() => void app.approve()}
              onExport={(format) => void app.exportPlan(format, download)}
              onVerify={() => {
                setTab("verify");
                void app.verify();
              }}
            />
          )}
          {tab === "chat" && !plan && (
            <div className="offline-plan-start">
              <p className="muted">{zh.manualPlanHint}</p>
              <button
                type="button"
                disabled={planBusy || !summary}
                onClick={() => setTab("plan")}
              >
                {zh.manualPlanStart}
              </button>
            </div>
          )}
          <details
            hidden={tab !== "chat"}
            className="planning-chat agent-disclosure planning-disclosure"
            open={planningChatOpen}
            onToggle={(event) => setPlanningChatOpen(event.currentTarget.open)}
          >
            <summary>{zh.planChatOptional}</summary>
            <ChatPanel
              controller={chatSessions.get(project.id, "plan")}
              locale={state.view.locale}
              context={chatContext}
              onSend={onSend}
            />
          </details>
          {tab === "source" && (
            <>
              <p className="muted">{zh.ownershipLiveSource}</p>
              <Inspector
                key={state.selectedNode?.id ?? "none"}
                node={state.selectedNode}
                source={state.source}
                context={state.context}
                busy={!!state.busy.inspect}
                onPage={(offset) => {
                  if (state.selectedNode) void app.pageInspection(offset);
                }}
                onExpand={(budget) => {
                  if (state.selectedNode)
                    void app.expand(state.selectedNode.id, 1, budget);
                }}
              />
            </>
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
                nodes={candidates}
                edge={edge}
                busy={planBusy || !summary || !!ownership.intent}
                onChoose={(id) => {
                  setEdge(undefined);
                  void app.choosePlan(id);
                }}
                onCreate={(title) => void app.createPlan(title)}
                onSave={(ops, title, description) => {
                  if (capture)
                    void app.savePlanCaptured(capture, ops, title, description);
                }}
                onValidate={() => void app.validate()}
                onApprove={() => void app.approve()}
                onExport={(format) => void app.exportPlan(format, download)}
                onClearEdge={() => setEdge(undefined)}
                onDirtyChange={app.setPlanEditorDirty}
              />
            </>
          )}
          {tab === "annotations" && (
            <WorkspaceAnnotationsPanel app={app} locale={state.view.locale} />
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
