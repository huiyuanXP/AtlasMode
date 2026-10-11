import { createStore } from "zustand/vanilla";
import type { CodeNode, Operation, PlanDetail } from "@codemap/core";
import { retargetFunction } from "../planning/function-target.js";
import {
  captureOwnershipIntent,
  completeTargetPath,
  matchesOwnershipIntent,
  type OwnershipIntent,
  type OwnershipTarget,
  type OwnershipTuple,
} from "./ownership.js";
import {
  createTargetTrayController,
  type TargetRequest,
  type TargetScope,
  type TargetTrayState,
} from "./ownership-controller.js";
export type OwnershipCapture = OwnershipTuple &
  Readonly<{ snapshotHash: string; epoch?: number }>;
export type OwnershipContext = OwnershipCapture & {
  selectedId?: string;
  operations: Operation[];
  title: string;
  description: string;
  busy: boolean;
  dirty: boolean;
  groupSelection: boolean;
  stale?: boolean;
};
export type OwnershipSessionState = {
  mode: "layout" | "ownership";
  status: "idle" | "dragging" | "preview" | "saving" | "expired" | "error";
  tray: TargetTrayState;
  intent?: OwnershipIntent;
  capture?: OwnershipCapture;
  source?: CodeNode;
  operations?: Operation[];
  target?: OwnershipTarget;
  filename: string;
  path?: string;
};
/** Last semantic destination, without inventing an indexed file/folder identity. */
export function plannedOwnershipTargets(
  operations: Operation[],
): OwnershipTarget[] {
  const paths = new Map<string, string>();
  for (const op of operations) {
    if (op.kind === "add_function") paths.set(op.tempId, op.filePath);
    if (op.kind === "move_function") paths.set(op.nodeId, op.filePath);
  }
  for (const op of operations)
    if (op.kind === "remove_function") paths.delete(op.nodeId);
  const result = new Map<string, OwnershipTarget>();
  for (const path of paths.values()) {
    result.set(`file:${path}`, { kind: "file", path, planned: true });
    const parts = path.split("/");
    parts.pop();
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      result.set(`folder:${folder}`, {
        kind: "folder",
        path: folder,
        planned: true,
      });
    }
  }
  return [...result.values()];
}
export function ownershipTargets(
  tray: TargetTrayState,
  operations: Operation[],
): OwnershipTarget[] {
  if (tray.status !== "ready" || !tray.scope || !tray.request) return [];
  const facts: OwnershipTarget[] = tray.scope.nodes.flatMap((node) =>
    node.filePath && (node.kind === "file" || node.kind === "folder")
      ? [{ kind: node.kind, path: node.filePath, id: node.id }]
      : [],
  );
  const root: OwnershipTarget = {
    kind: "folder",
    path: tray.request.path,
    ...(tray.scope.missing ? { planned: true } : {}),
  };
  const planned = plannedOwnershipTargets(operations).filter(
    (t) => !facts.some((f) => f.kind === t.kind && f.path === t.path),
  );
  return [root, ...facts, ...planned];
}
export function sameOwnershipCapture(a: OwnershipCapture, b: OwnershipCapture) {
  return (
    a.projectId === b.projectId &&
    a.planId === b.planId &&
    a.revision === b.revision &&
    a.snapshotId === b.snapshotId &&
    a.snapshotHash === b.snapshotHash &&
    (a.epoch ?? 0) === (b.epoch ?? 0)
  );
}
const idle = (): OwnershipSessionState => ({
  mode: "layout",
  status: "idle",
  tray: { status: "idle" },
  filename: "",
});
export function createOwnershipSession(ports: {
  current: () => OwnershipContext | undefined;
  resolveSource: (
    id: string,
  ) => { node: CodeNode; snapshotId: string } | undefined;
  fetchScope: (request: TargetRequest) => Promise<TargetScope>;
  save: (
    capture: OwnershipCapture,
    operations: Operation[],
  ) => Promise<PlanDetail | undefined>;
  conflict?: () => boolean;
  nonce?: () => string;
}) {
  const store = createStore<OwnershipSessionState>(idle);
  const set = store.setState,
    get = store.getState;
  let generation = 0;
  let observed: OwnershipCapture | undefined;
  const capture = (context: OwnershipCapture): OwnershipCapture =>
    Object.freeze({
      projectId: context.projectId,
      planId: context.planId,
      revision: context.revision,
      snapshotId: context.snapshotId,
      snapshotHash: context.snapshotHash,
      epoch: context.epoch ?? 0,
    });
  // A target scope depends on current project/plan/view/snapshot, not plan revision.
  const sameAuthority = (a: OwnershipCapture, b: OwnershipCapture) =>
    sameOwnershipCapture({ ...a, revision: b.revision }, b);
  const requestCurrent = (request: TargetRequest) => {
    const context = ports.current();
    return (
      !!context &&
      !!observed &&
      sameAuthority(observed, context) &&
      request.projectId === context.projectId &&
      request.snapshotId === context.snapshotId &&
      (request.epoch ?? 0) === (context.epoch ?? 0) &&
      request.budget === 100
    );
  };
  const tray = createTargetTrayController(
    ports.fetchScope,
    (value) => set({ tray: value }),
    requestCurrent,
  );
  const targetsReady = (
    context: OwnershipCapture | undefined = ports.current(),
  ) => {
    const state = get().tray;
    return (
      !!context &&
      !!observed &&
      sameAuthority(observed, context) &&
      state.status === "ready" &&
      !!state.request &&
      !!state.scope &&
      requestCurrent(state.request) &&
      state.request.projectId === context.projectId &&
      state.request.snapshotId === context.snapshotId &&
      state.scope.snapshotId === context.snapshotId &&
      state.scope.path === state.request.path &&
      state.scope.kind === "folder"
    );
  };
  const eligible = (context?: OwnershipContext) =>
    !!context &&
    !context.busy &&
    !context.dirty &&
    !context.groupSelection &&
    !context.stale;
  const currentIntent = () => {
    const state = get(),
      context = ports.current();
    return (
      state.status !== "expired" &&
      !!state.intent &&
      !!state.capture &&
      !!context &&
      eligible(context) &&
      sameOwnershipCapture(state.capture, context) &&
      matchesOwnershipIntent(
        state.intent,
        context,
        context.selectedId,
        state.intent.nonce,
      )
    );
  };
  const cancel = () => {
    generation++;
    set({
      status: "idle",
      intent: undefined,
      capture: undefined,
      source: undefined,
      operations: undefined,
      target: undefined,
      filename: "",
      path: undefined,
    });
  };
  const retire = () => {
    if (get().intent && get().status !== "expired") {
      generation++;
      set({ status: "expired" });
    }
  };
  const reconcile = () => {
    const state = get(),
      context = ports.current();
    if (state.mode !== "ownership") return;
    if (
      !context ||
      (observed &&
        (observed.projectId !== context.projectId ||
          observed.planId !== context.planId ||
          (observed.epoch ?? 0) !== (context.epoch ?? 0)))
    ) {
      generation++;
      observed = undefined;
      tray.cancel();
      set(idle());
      return;
    }
    if (
      observed &&
      (observed.snapshotId !== context.snapshotId ||
        observed.snapshotHash !== context.snapshotHash)
    ) {
      // Retire the scope even when no gesture exists; cancel also rejects pending replies.
      retire();
      observed = capture(context);
      tray.cancel();
      return;
    }
    if (state.status === "saving") {
      // Own busy/revision ACK is expected; another selection permanently retires the preview.
      if (state.intent && context.selectedId !== state.intent.sourceId)
        retire();
      return;
    }
    if (state.intent && !currentIntent()) retire();
  };
  const choose = (target: OwnershipTarget, nonce?: string) => {
    reconcile();
    const state = get();
    if (
      !currentIntent() ||
      !targetsReady(state.capture) ||
      state.status === "saving" ||
      (nonce !== undefined && nonce !== state.intent?.nonce)
    )
      return false;
    if (
      !ownershipTargets(state.tray, state.operations ?? []).some(
        (t) =>
          t.kind === target.kind &&
          t.path === target.path &&
          t.id === target.id &&
          !!t.planned === !!target.planned,
      )
    )
      return false;
    let path: string | undefined;
    try {
      path = completeTargetPath(target);
    } catch {
      /* A folder requires a new explicit filename. */
    }
    set({
      status: "preview",
      target: Object.freeze({ ...target }),
      filename: "",
      path,
    });
    return true;
  };
  return {
    store,
    reconcile,
    cancel,
    targetsReady,
    async setMode(mode: OwnershipSessionState["mode"]) {
      if (mode === "layout") {
        generation++;
        observed = undefined;
        tray.cancel();
        set(idle());
        return;
      }
      const context = ports.current();
      if (!eligible(context)) return;
      cancel();
      observed = capture(context!);
      set({ mode: "ownership" });
      await tray.load({
        projectId: context!.projectId,
        snapshotId: context!.snapshotId,
        epoch: context!.epoch ?? 0,
        path: ".",
      });
    },
    async browse(path: string) {
      reconcile();
      const context = ports.current();
      if (
        get().mode !== "ownership" ||
        !eligible(context) ||
        get().status === "saving"
      )
        return;
      await tray.load({
        projectId: context!.projectId,
        snapshotId: context!.snapshotId,
        epoch: context!.epoch ?? 0,
        path,
      });
    },
    begin(id: string) {
      reconcile();
      const context = ports.current(),
        proof = ports.resolveSource(id);
      if (
        get().mode !== "ownership" ||
        !eligible(context) ||
        !targetsReady(context) ||
        !proof ||
        context!.selectedId !== id ||
        get().status === "saving"
      )
        return;
      try {
        const capture = Object.freeze({
          projectId: context!.projectId,
          snapshotId: context!.snapshotId,
          snapshotHash: context!.snapshotHash,
          epoch: context!.epoch ?? 0,
          planId: context!.planId,
          revision: context!.revision,
        });
        const operations = structuredClone(context!.operations);
        const source = structuredClone(proof.node);
        const intent = captureOwnershipIntent(
          capture,
          source,
          operations,
          ports.nonce?.() ?? crypto.randomUUID(),
          proof.snapshotId,
        );
        generation++;
        set({
          status: "dragging",
          capture,
          intent,
          source,
          operations,
          target: undefined,
          filename: "",
          path: undefined,
        });
        return intent.nonce;
      } catch {
        return;
      }
    },
    choose,
    endDrag() {
      if (get().status === "dragging") cancel();
    },
    filename(filename: string) {
      const state = get();
      if (
        !state.target ||
        state.target.kind !== "folder" ||
        state.status === "saving"
      )
        return;
      let path: string | undefined;
      try {
        path = completeTargetPath(state.target, filename);
      } catch {
        /* Display invalid input, never turn it into authority. */
      }
      set({ filename, path });
    },
    async confirm() {
      reconcile();
      const state = get(),
        context = ports.current();
      if (
        !currentIntent() ||
        !targetsReady(state.capture) ||
        !state.target ||
        !ownershipTargets(state.tray, state.operations ?? []).some(
          (target) =>
            target.kind === state.target!.kind &&
            target.path === state.target!.path &&
            target.id === state.target!.id &&
            !!target.planned === !!state.target!.planned,
        ) ||
        !state.source ||
        !state.operations ||
        !state.capture ||
        !state.path ||
        state.status !== "preview" ||
        !context
      )
        return false;
      const operations = retargetFunction(
        state.operations,
        state.source,
        state.path,
      );
      if (operations === state.operations) {
        cancel();
        return true;
      }
      const attempt = ++generation;
      set({ status: "saving" });
      try {
        const accepted = await ports.save(state.capture, operations);
        if (attempt !== generation) return false;
        if (!accepted) {
          set({
            status:
              currentIntent() && !ports.conflict?.() ? "error" : "expired",
          });
          return false;
        }
        // The save port verifies captured authority before committing UI/history.
        // Verify its returned identity/revision too; a foreign ACK never clears this preview.
        if (
          accepted.plan.projectId !== state.capture.projectId ||
          accepted.plan.id !== state.capture.planId ||
          accepted.plan.revision !== state.capture.revision + 1 ||
          JSON.stringify(accepted.plan.operations) !==
            JSON.stringify(operations)
        ) {
          set({ status: "expired" });
          return false;
        }
        cancel();
        return true;
      } catch {
        if (attempt === generation)
          set({
            status:
              currentIntent() && !ports.conflict?.() ? "error" : "expired",
          });
        return false;
      }
    },
  };
}
