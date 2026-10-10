import { randomUUID } from "node:crypto";
import {
  DomainError,
  normalizeRepoPath,
  validateRoute,
  type BrowseRoute,
  type CodeSnapshot,
  type DirectoryPolicy,
  type FunctionGroup,
  type StoragePort,
  type Plan,
  type ViewState,
} from "@codemap/core";
import { inputKeys } from "./planning.js";

function text(value: unknown): value is string {
  return typeof value === "string";
}
function prefix(value: string, root = false): string {
  if (!text(value)) throw new DomainError("INVALID_INPUT", "Expected a path.");
  const trimmed = value.replaceAll("\\", "/").replace(/\/+$/, "");
  if (
    root &&
    (trimmed === "" || trimmed === ".") &&
    !value.replaceAll("\\", "/").startsWith("/")
  )
    return "";
  return normalizeRepoPath(trimmed);
}
export class Knowledge {
  constructor(
    private readonly storage: StoragePort,
    private readonly snapshot: (id: string) => CodeSnapshot,
  ) {}
  routes(projectId: string): BrowseRoute[] {
    this.snapshot(projectId);
    return this.storage
      .list<BrowseRoute>("routes")
      .filter((r) => r.projectId === projectId);
  }
  createRoute(
    input: Omit<BrowseRoute, "id" | "revision" | "createdAt">,
  ): BrowseRoute {
    inputKeys(input, [
      "projectId",
      "snapshotId",
      "title",
      "description",
      "source",
      "kind",
      "steps",
    ]);
    const route = {
      ...input,
      id: randomUUID(),
      revision: 1,
      createdAt: new Date().toISOString(),
    };
    const issues = validateRoute(route, this.snapshot(input.projectId));
    if (issues.some((i) => i.severity === "error"))
      throw new DomainError(
        "INVALID_INPUT",
        issues.map((i) => i.message).join(" "),
      );
    this.storage.put("routes", route.id, route);
    return route;
  }
  view(projectId: string): ViewState {
    this.snapshot(projectId);
    return this.normalizeView(
      projectId,
      this.storage.get<ViewState>("views", projectId) ?? {
        positions: {},
        theme: "light",
        locale: "zh",
      },
    );
  }
  saveView(projectId: string, view: ViewState): ViewState {
    this.snapshot(projectId);
    inputKeys(view, ["positions", "theme", "locale", "collapsedGroupIds"]);
    if (
      view.collapsedGroupIds !== undefined &&
      (!Array.isArray(view.collapsedGroupIds) ||
        view.collapsedGroupIds.length > 200 ||
        view.collapsedGroupIds.some(
          (id) => typeof id !== "string" || id.length < 1 || id.length > 200,
        ))
    )
      throw new DomainError("INVALID_INPUT", "Invalid collapsed group IDs.");
    if (
      !["light", "dark"].includes(view.theme) ||
      !["zh", "en"].includes(view.locale) ||
      !view.positions ||
      typeof view.positions !== "object" ||
      Array.isArray(view.positions)
    )
      throw new DomainError("INVALID_INPUT", "Invalid view state.");
    for (const position of Object.values(view.positions)) {
      inputKeys(position, ["x", "y"]);
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
        throw new DomainError(
          "INVALID_INPUT",
          "Positions must be finite coordinates.",
        );
    }
    const normalized = this.normalizeView(projectId, view);
    this.storage.put("views", projectId, normalized);
    return normalized;
  }
  private normalizeView(projectId: string, view: ViewState): ViewState {
    if (view.collapsedGroupIds === undefined) return view;
    const known = new Set(this.groups(projectId).map((group) => group.id));
    return {
      ...view,
      collapsedGroupIds: [...new Set(view.collapsedGroupIds)].filter((id) =>
        known.has(id),
      ),
    };
  }
  groups(projectId: string): FunctionGroup[] {
    this.snapshot(projectId);
    return this.storage
      .list<FunctionGroup>("groups")
      .filter((g) => g.projectId === projectId);
  }
  saveGroup(input: Omit<FunctionGroup, "id"> & { id?: string }): FunctionGroup {
    inputKeys(input, [
      "id",
      "projectId",
      "title",
      "description",
      "source",
      "memberIds",
    ]);
    const snapshot = this.snapshot(input.projectId);
    if (
      !text(input.title) ||
      !input.title.trim() ||
      !text(input.description) ||
      !["agent", "user"].includes(input.source) ||
      !Array.isArray(input.memberIds) ||
      input.memberIds.some(
        (id) =>
          !snapshot.nodes.some((n) => n.id === id && n.kind === "function"),
      )
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Invalid group or function members.",
      );
    const id = input.id ?? randomUUID();
    this.checkOwner("groups", id, input.projectId);
    const group = { ...input, id, memberIds: [...new Set(input.memberIds)] };
    this.saveDesign("groups", group, (value) => {
      const g = value as FunctionGroup;
      return JSON.stringify([
        g.title,
        g.description,
        [...new Set(g.memberIds)].sort(),
      ]);
    });
    return group;
  }
  policies(projectId: string): DirectoryPolicy[] {
    this.snapshot(projectId);
    return this.storage
      .list<DirectoryPolicy>("policies")
      .filter((p) => p.projectId === projectId);
  }
  savePolicy(
    input: Omit<DirectoryPolicy, "id"> & { id?: string },
  ): DirectoryPolicy {
    inputKeys(input, [
      "id",
      "projectId",
      "pathPrefix",
      "purpose",
      "forbiddenDependencies",
    ]);
    this.snapshot(input.projectId);
    if (!text(input.purpose) || !Array.isArray(input.forbiddenDependencies))
      throw new DomainError("INVALID_INPUT", "Invalid directory policy.");
    const id = input.id ?? randomUUID();
    this.checkOwner("policies", id, input.projectId);
    const policy = {
      ...input,
      id,
      pathPrefix: prefix(input.pathPrefix, true),
      forbiddenDependencies: input.forbiddenDependencies.map((p) => prefix(p)),
    };
    this.saveDesign("policies", policy, (value) => {
      const p = value as DirectoryPolicy;
      return JSON.stringify([
        prefix(p.pathPrefix, true),
        p.purpose,
        [
          ...new Set(p.forbiddenDependencies.map((path) => prefix(path))),
        ].sort(),
      ]);
    });
    return policy;
  }
  // Knowledge is part of the review context. Advance current plan revisions in
  // the same transaction; immutable approval snapshots remain verifiable.
  private saveDesign<T extends FunctionGroup | DirectoryPolicy>(
    kind: "groups" | "policies",
    value: T,
    content: (value: T) => string,
  ): void {
    this.storage.transaction(() => {
      const previous = this.storage.get<T>(kind, value.id);
      const changed = !previous || content(previous) !== content(value);
      this.storage.put(kind, value.id, value);
      if (!changed) return;
      for (const plan of this.storage.list<Plan>("plans")) {
        if (plan.projectId !== value.projectId) continue;
        this.storage.put("plans", plan.id, {
          ...plan,
          revision: plan.revision + 1,
          status: "draft",
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }
  private checkOwner(
    kind: "groups" | "policies",
    id: string,
    projectId: string,
  ): void {
    if (!text(id) || !id)
      throw new DomainError("INVALID_INPUT", "Expected a record id.");
    const existing = this.storage.get<{ projectId: string }>(kind, id);
    if (existing && existing.projectId !== projectId)
      throw new DomainError(
        "PROJECT_MISMATCH",
        "Record belongs to another project.",
      );
  }
}
