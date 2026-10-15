import { createStore } from "zustand/vanilla";
import { PoliciesPanel } from "./PoliciesPanel.js";
import { createWorkspace } from "../../app/workspace.js";
import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactNode } from "react";
import { StructurePolicyPanel } from "./StructurePolicyPanel.js";
import { createPolicyController } from "./policy-controller.js";
function node(n: ReactNode, action: string): Record<string, unknown> {
  if (isValidElement(n)) {
    const p = n.props as Record<string, unknown>;
    if (p["data-action"] === action) return p;
    for (const c of Array.isArray(p.children) ? p.children : [p.children]) {
      try {
        return node(c as ReactNode, action);
      } catch {}
    }
  }
  throw Error(action);
}
function fixture() {
  const api = {
    readState: vi.fn(),
    readPolicies: vi.fn(),
    preview: vi.fn(),
    savePolicy: vi.fn(),
    writeStructure: vi.fn(),
  };
  const c = createPolicyController(api);
  c.selectProject("a");
  const handlers = {
    onReload: vi.fn(),
    onConflictRead: vi.fn(),
    onChoose: vi.fn(),
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onRetry: vi.fn(),
    onPreview: vi.fn(),
    onImport: vi.fn(),
  };
  return {
    c,
    handlers,
    props: { state: c.store.getState(), locale: "en" as const, ...handlers },
  };
}
test.each(["en", "zh"] as const)(
  "%s retains accessible old form and explicit reread/preview/save controls",
  (locale) => {
    const { props } = fixture();
    const html = renderToStaticMarkup(
      <StructurePolicyPanel {...props} locale={locale} />,
    );
    for (const action of [
      "save",
      "reload",
      "preview",
      "new-folder",
      "new-policy",
    ])
      expect(html).toContain(`data-action="${action}"`);
    expect(html).toContain(
      locale === "zh" ? "禁止依赖" : "Forbidden dependencies",
    );
    expect(html).toContain(locale === "zh" ? "用途" : "Purpose");
  },
);
test("real component conflict read is explicit and passes a distinct callback", () => {
  const { props, handlers } = fixture();
  (node(StructurePolicyPanel(props), "reload").onClick as () => void)();
  expect(handlers.onReload).toHaveBeenCalledTimes(1);
  expect(handlers.onConflictRead).not.toHaveBeenCalled();
});
test("read-only schema metadata and diagnostics are escaped, never rendered as satisfied rules", () => {
  const { props } = fixture();
  props.state.snapshot = {
    projectId: "a",
    schemaVersion: 1,
    structureRevision: 1,
    fileDigest: null,
    semanticDigest: null,
    verifiedAt: "t",
    legacyPendingCount: 0,
    status: "invalid",
    diagnostics: [
      {
        pointer: "/folders",
        kind: "schema",
        message: "<script>error</script>",
      },
    ],
    document: {
      schemaVersion: 1,
      folders: [
        {
          path: "src",
          purpose: "<script>purpose</script>",
          allowed: ["allowed text"],
          forbidden: ["forbidden text"],
          custom: "kept",
        },
      ],
      dependencyRules: [],
      extension: { unknown: "retained" },
    },
  };
  const html = renderToStaticMarkup(<StructurePolicyPanel {...props} />);
  expect(html).toContain("allowed text");
  expect(html).toContain("forbidden text");
  expect(html).toContain("retained");
  expect(html).toContain("&lt;script&gt;error");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Read-only metadata");
  expect(html).not.toContain("Rules satisfied");
});

test("actual DB-only and file-extension provenance is distinct from unexecuted folder metadata", () => {
  const { props } = fixture();
  props.state.policies = [
    {
      id: "db",
      projectId: "a",
      pathPrefix: "db",
      purpose: "db purpose",
      forbiddenDependencies: ["inside"],
    },
    {
      id: "file",
      projectId: "a",
      pathPrefix: "file",
      purpose: "file purpose",
      forbiddenDependencies: [],
    },
  ];
  props.state.snapshot = {
    projectId: "a",
    schemaVersion: 1,
    structureRevision: 1,
    fileDigest: null,
    semanticDigest: null,
    verifiedAt: "t",
    legacyPendingCount: 1,
    status: "ready",
    diagnostics: [],
    document: {
      schemaVersion: 1,
      folders: [],
      dependencyRules: [],
      "x-atlasmode": {
        schemaVersion: 1,
        legacyPathPolicies: [
          {
            id: "file",
            pathPrefix: "file",
            purpose: "file purpose",
            forbiddenDependencies: [],
          },
        ],
      },
    },
  };
  const html = renderToStaticMarkup(<StructurePolicyPanel {...props} />);
  expect(html).toContain("Database policy; not migrated");
  expect(html).toContain("File extension policy");
  expect(html).toContain("Existing target-path checks");
  expect(html).toContain(".codemap/structure.json");
});

test.each(["knowledge", "project", "plan"])(
  "existing wrapper retains %s busy gating without hiding old controls",
  (busy) => {
    const app = createWorkspace();
    app.store.setState({
      project: { id: "p", path: "/owned", name: "Owned" },
      busy: { [busy]: true },
      view: { positions: {}, locale: "en", theme: "light" },
    });
    // SSR uses getInitialState, so seed the real store before the renderer reads it.
    const initial = app.store.getState();
    const html = renderToStaticMarkup(
      <PoliciesPanel app={{ ...app, store: createStore(() => initial) }} />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('data-action="save"');
    expect(html).toContain('data-action="new-policy"');
    expect(html).toContain('aria-label="Purpose"');
  },
);
test("controlled form retains unsaved purpose and dependency input while conflict requires reread", () => {
  const { props } = fixture();
  props.state.draft = {
    kind: "legacy",
    id: "db",
    path: "src/mine",
    purpose: "<mine purpose>",
    forbidden: "one\ntwo",
  };
  props.state.error = { code: "STRUCTURE_CONFLICT", message: "read again" };
  props.state.needsReload = true;
  const html = renderToStaticMarkup(<StructurePolicyPanel {...props} />);
  expect(html).toContain('value="src/mine"');
  expect(html).toContain("&lt;mine purpose&gt;");
  expect(html).toContain("one\ntwo");
  expect(html).toContain('data-action="save" disabled=""');
  expect(html).toContain('data-action="reload"');
});

test("I1 import acknowledgment describes unsaved form B rather than claiming it saved", () => {
  const { props } = fixture();
  props.state.draft.purpose = "local unsaved B";
  props.state.dirty = true;
  props.state.notice = "imported";
  props.state.needsReload = true;
  const html = renderToStaticMarkup(<StructurePolicyPanel {...props} />);
  expect(html).toContain("Import completed; form edits remain unsaved");
  expect(html).not.toContain("Saved. Read again");
  expect(html).toContain("local unsaved B");
});
test("M1 known save with workspace sync failure shows saved-sync-failed and reread, without uncertain replay", () => {
  const { props } = fixture();
  props.state.notice = "saved";
  props.state.needsReload = true;
  props.state.error = { code: "WORKSPACE_SYNC_REQUIRED", message: "offline" };
  const html = renderToStaticMarkup(<StructurePolicyPanel {...props} />);
  expect(html).toContain("Saved; workspace synchronization failed");
  expect(html).toContain('data-action="reload"');
  expect(html).not.toContain('data-action="retry"');
});
