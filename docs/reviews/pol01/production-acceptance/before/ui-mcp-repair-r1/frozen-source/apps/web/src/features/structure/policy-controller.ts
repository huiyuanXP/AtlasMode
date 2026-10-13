import { createStore } from "zustand/vanilla";
import {
  normalizeStructurePath,
  projectStructurePolicies,
  type DirectoryPolicy,
  type StructureState,
  type StructureWriteInput,
} from "@codemap/core";
import {
  StructureClientError,
  type LegacyPreview,
  type PolicyCapture,
  type StructureTransport,
} from "../../api/structure-client.js";
export type PolicyDraft = {
  kind: "legacy" | "folder";
  id?: string;
  previousPath?: string;
  path: string;
  purpose: string;
  forbidden: string;
};
export type AcceptedPolicyResponse = {
  projectId: string;
  epoch: number;
  operation: StructureWriteInput["operation"];
  result: DirectoryPolicy | StructureState;
};
export type AcceptedPolicyReadResponse = {
  projectId: string;
  epoch: number;
  snapshot: StructureState;
  policies: DirectoryPolicy[];
};
export type PolicyPanelState = {
  projectId: string;
  epoch: number;
  busy: boolean;
  draft: PolicyDraft;
  dirty: boolean;
  policies: DirectoryPolicy[];
  snapshot?: StructureState;
  capture?: PolicyCapture;
  preview?: LegacyPreview;
  error?: { code: string; message: string };
  needsReload: boolean;
  retryAvailable: boolean;
  notice?: "saved" | "imported";
};
type Request = {
  projectId: string;
  epoch: number;
  input: StructureWriteInput;
  kind: "legacy" | "structure";
};
const blankDraft = (): PolicyDraft => ({
  kind: "legacy",
  path: "",
  purpose: "",
  forbidden: "",
});
const same = (a: PolicyCapture, b: PolicyCapture) =>
  a.structureRevision === b.structureRevision && a.fileDigest === b.fileDigest;
const usable = (s?: StructureState) =>
  s?.status === "ready" || s?.status === "missing";
/** Project epochs and explicit captures are owned here, outside the shared workspace. */
export function createPolicyController(
  api: StructureTransport,
  onAccepted: (
    response: AcceptedPolicyResponse,
  ) => void | Promise<void> = () => {},
  uuid: () => string = () => crypto.randomUUID(),
  onReadAccepted: (
    response: AcceptedPolicyReadResponse,
  ) => void | Promise<void> = () => {},
) {
  const store = createStore<PolicyPanelState>(() => ({
    projectId: "",
    epoch: 0,
    busy: false,
    draft: blankDraft(),
    dirty: false,
    policies: [],
    needsReload: true,
    retryAvailable: false,
  }));
  let generation = 0,
    request: Request | undefined;
  const current = (epoch: number, read?: number) =>
    store.getState().epoch === epoch &&
    (read === undefined || generation === read);
  const error = (e: unknown) => ({
    code:
      e instanceof StructureClientError ? e.code : "STRUCTURE_REQUEST_FAILED",
    message: e instanceof Error ? e.message : String(e),
  });
  const eligible = () => {
    const s = store.getState();
    return (
      !!s.projectId &&
      !s.busy &&
      !s.needsReload &&
      !!s.capture &&
      usable(s.snapshot)
    );
  };
  async function submit(r: Request) {
    if (!current(r.epoch)) return;
    const token = ++generation;
    request = r;
    store.setState({
      busy: true,
      error: undefined,
      retryAvailable: false,
      preview: undefined,
    });
    try {
      const op = r.input.operation;
      const result = await (r.kind === "legacy" &&
      op.kind === "upsertLegacyPolicy"
        ? api.savePolicy(r.projectId, {
            ...(op.id === undefined ? {} : { id: op.id }),
            pathPrefix: op.pathPrefix,
            purpose: op.purpose,
            forbiddenDependencies: op.forbiddenDependencies,
            mutationId: r.input.mutationId,
            expectedStructureRevision: r.input.expectedStructureRevision,
            expectedFileDigest: r.input.expectedFileDigest,
          })
        : api.writeStructure(r.projectId, r.input));
      if (!current(r.epoch, token)) return;
      if (result.projectId !== r.projectId)
        throw new StructureClientError(
          "PROJECT_MISMATCH",
          "Write response belongs to another project.",
          409,
        );
      // An ACK is not a fresh read capture. A new edit needs an explicit reread.
      const draft = store.getState().draft;
      let acknowledged = draft;
      if (op.kind === "upsertLegacyPolicy" && r.kind === "legacy") {
        const policy = result as DirectoryPolicy;
        acknowledged = {
          kind: "legacy",
          id: policy.id,
          path: policy.pathPrefix,
          purpose: policy.purpose,
          forbidden: policy.forbiddenDependencies.join("\n"),
        };
      } else if (op.kind === "upsertFolder") {
        const path = normalizeStructurePath(op.path);
        acknowledged = { ...draft, path, previousPath: path };
      }
      request = undefined;
      store.setState({
        busy: true,
        draft: acknowledged,
        dirty: op.kind === "importLegacy" ? store.getState().dirty : false,
        needsReload: true,
        retryAvailable: false,
        notice: op.kind === "importLegacy" ? "imported" : "saved",
      });
      try {
        await onAccepted({
          projectId: r.projectId,
          epoch: r.epoch,
          operation: op,
          result,
        });
      } catch (e) {
        if (current(r.epoch, token))
          store.setState({
            error: {
              code: "WORKSPACE_SYNC_REQUIRED",
              message:
                e instanceof Error ? e.message : "Workspace refresh required.",
            },
          });
      } finally {
        if (current(r.epoch, token)) store.setState({ busy: false });
      }
    } catch (e) {
      if (!current(r.epoch, token)) return;
      const terminal =
        e instanceof StructureClientError &&
        e.status !== undefined &&
        e.status >= 400 &&
        e.status < 500;
      if (terminal) request = undefined;
      store.setState({
        busy: false,
        error: error(e),
        needsReload: terminal,
        retryAvailable: !terminal,
      });
    }
  }
  return {
    store,
    selectProject(projectId: string) {
      generation++;
      request = undefined;
      store.setState(
        {
          projectId,
          epoch: store.getState().epoch + 1,
          busy: false,
          draft: blankDraft(),
          dirty: false,
          policies: [],
          snapshot: undefined,
          capture: undefined,
          preview: undefined,
          error: undefined,
          needsReload: true,
          retryAvailable: false,
          notice: undefined,
        },
        true,
      );
    },
    dispose() {
      generation++;
      request = undefined;
      store.setState({ epoch: store.getState().epoch + 1, busy: false });
    },
    async reload(acceptExternalConflict = false) {
      const s = store.getState();
      if (!s.projectId || s.busy) return;
      const epoch = s.epoch,
        read = ++generation;
      const retained = request;
      store.setState({
        busy: true,
        error: undefined,
        preview: undefined,
        retryAvailable: false,
        needsReload: true,
      });
      try {
        const snapshot = await api.readState(
          s.projectId,
          acceptExternalConflict,
        );
        if (!current(epoch, read)) return;
        if (
          !Number.isSafeInteger(snapshot.structureRevision) ||
          snapshot.structureRevision < 0 ||
          (snapshot.fileDigest !== null &&
            (typeof snapshot.fileDigest !== "string" ||
              !/^[0-9a-f]{64}$/.test(snapshot.fileDigest)))
        )
          throw new StructureClientError(
            "STRUCTURE_CAPTURE_INVALID",
            "Structure response has no valid revision/digest capture.",
          );
        if (snapshot.projectId !== s.projectId)
          throw new StructureClientError(
            "PROJECT_MISMATCH",
            "Structure belongs to another project.",
          );
        // Quarantined states can render diagnostics without pretending policies were read.
        if (!usable(snapshot)) {
          store.setState({
            busy: false,
            snapshot,
            capture: undefined,
            needsReload: true,
            retryAvailable: !!retained && request === retained,
          });
          return;
        }
        const policies = await api.readPolicies(s.projectId);
        if (!current(epoch, read)) return;
        if (
          !same(snapshot, policies) ||
          snapshot.status !== policies.status ||
          policies.policies.some((p) => p.projectId !== s.projectId)
        )
          throw new StructureClientError(
            "STRUCTURE_CONFLICT",
            "Structure changed during read. Read again explicitly.",
            409,
          );
        const folderIds = new Set(
          snapshot.document
            ? projectStructurePolicies(
                {
                  ...snapshot.document,
                  "x-atlasmode": { legacyPathPolicies: [] },
                },
                s.projectId,
              ).map((p) => p.id)
            : [],
        );
        store.setState({
          busy: true,
          snapshot,
          policies: policies.policies.filter((p) => !folderIds.has(p.id)),
          capture: {
            structureRevision: snapshot.structureRevision,
            fileDigest: snapshot.fileDigest,
            verifiedAt: snapshot.verifiedAt,
          },
          needsReload: false,
          error: undefined,
        });
        try {
          await onReadAccepted({
            projectId: s.projectId,
            epoch,
            snapshot,
            policies: policies.policies,
          });
        } catch (e) {
          throw new StructureClientError(
            "WORKSPACE_SYNC_REQUIRED",
            e instanceof Error ? e.message : "Workspace refresh required.",
          );
        }
        if (current(epoch, read)) {
          // A read attempt is not resolution: keep unknown input until the
          // matched state/policies and accepted-read callback all succeeded.
          if (request === retained) request = undefined;
          store.setState({
            busy: false,
            retryAvailable: false,
            notice: undefined,
          });
        }
      } catch (e) {
        if (current(epoch, read))
          store.setState({
            busy: false,
            error: error(e),
            capture: undefined,
            needsReload: true,
            retryAvailable: !!retained && request === retained,
          });
      }
    },
    choose(selection: string) {
      const s = store.getState();
      if (s.busy || request) return;
      let draft = blankDraft();
      if (selection === "new-folder") draft = { ...draft, kind: "folder" };
      else if (selection.startsWith("folder:")) {
        const f = s.snapshot?.document?.folders.find(
          (f) => f.path === selection.slice(7),
        );
        if (!f) return;
        draft = {
          kind: "folder",
          previousPath: f.path,
          path: f.path,
          purpose: f.purpose,
          forbidden: "",
        };
      } else if (selection.startsWith("legacy:")) {
        const p = s.policies.find((p) => p.id === selection.slice(7));
        if (!p) return;
        draft = {
          kind: "legacy",
          id: p.id,
          path: p.pathPrefix,
          purpose: p.purpose,
          forbidden: p.forbiddenDependencies.join("\n"),
        };
      }
      store.setState({
        draft,
        dirty: false,
        error: undefined,
        notice: undefined,
      });
    },
    edit(patch: Partial<Pick<PolicyDraft, "path" | "purpose" | "forbidden">>) {
      if (store.getState().busy || request) return;
      store.setState((s) => ({
        draft: { ...s.draft, ...patch },
        dirty: true,
        notice: undefined,
      }));
    },
    async save() {
      if (!eligible() || request) return;
      const s = store.getState(),
        d = s.draft,
        c = s.capture!;
      const operation: StructureWriteInput["operation"] =
        d.kind === "folder"
          ? {
              kind: "upsertFolder",
              ...(d.previousPath === undefined
                ? {}
                : { previousPath: d.previousPath }),
              path: d.path,
              purpose: d.purpose,
            }
          : {
              kind: "upsertLegacyPolicy",
              ...(d.id === undefined ? {} : { id: d.id }),
              pathPrefix: d.path,
              purpose: d.purpose,
              forbiddenDependencies: d.forbidden
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            };
      await submit({
        projectId: s.projectId,
        epoch: s.epoch,
        kind: d.kind === "legacy" ? "legacy" : "structure",
        input: {
          mutationId: uuid(),
          expectedStructureRevision: c.structureRevision,
          expectedFileDigest: c.fileDigest,
          operation,
        },
      });
    },
    async retry() {
      const r = request;
      if (!r || store.getState().busy || !store.getState().retryAvailable)
        return;
      await submit(r);
    },
    async previewLegacy() {
      if (!eligible() || request) return;
      const s = store.getState();
      store.setState({ busy: true, error: undefined, preview: undefined });
      try {
        const p = await api.preview(s.projectId);
        if (!current(s.epoch)) return;
        if (!same(p, s.capture!))
          throw new StructureClientError(
            "STRUCTURE_CONFLICT",
            "Migration preview changed. Read again explicitly.",
            409,
          );
        store.setState({ busy: false, preview: p });
      } catch (e) {
        if (current(s.epoch))
          store.setState({ busy: false, error: error(e), needsReload: true });
      }
    },
    async importLegacy() {
      if (!eligible() || request) return;
      const s = store.getState(),
        p = s.preview;
      if (!p || !p.policies.length || !same(p, s.capture!)) return;
      await submit({
        projectId: s.projectId,
        epoch: s.epoch,
        kind: "structure",
        input: {
          mutationId: uuid(),
          expectedStructureRevision: p.structureRevision,
          expectedFileDigest: p.fileDigest,
          operation: { kind: "importLegacy" },
        },
      });
    },
  };
}
