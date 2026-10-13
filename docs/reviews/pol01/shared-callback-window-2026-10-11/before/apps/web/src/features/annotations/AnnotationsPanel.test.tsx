import { expect, test } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnnotationsPanel,
  type AnnotationsPanelProps,
} from "./AnnotationsPanel.js";
import { AnnotationHistoryView } from "./AnnotationHistoryView.js";
import {
  createAnnotationEditor,
  openAnnotationDraft,
  changeAnnotationDraft,
  beginAnnotationRequest,
  prepareAnnotationCandidate,
} from "./draft.js";
import { scope, snapshot, detail } from "./fixtures.test-support.js";
import type { AnnotationRequest } from "./draft.js";
function props(): AnnotationsPanelProps {
  return {
    scope,
    locale: "en",
    state: openAnnotationDraft(createAnnotationEditor(scope, "User"), detail()),
    page: {
      scope,
      status: "ready",
      value: {
        items: [detail()],
        total: 1,
        offset: 0,
        limit: 20,
        truncated: false,
        snapshotId: "s1",
      },
    },
    onState: () => {},
    onRequest: () => {},
    onList: () => {},
    onHistory: () => {},
    onReload: () => {},
  };
}
function event(node: ReactNode, action: string): Record<string, unknown> {
  if (isValidElement(node)) {
    const p = node.props as Record<string, unknown>;
    if (p["data-action"] === action) return p;
    for (const child of Array.isArray(p.children) ? p.children : [p.children]) {
      try {
        return event(child as ReactNode, action);
      } catch {
        /*Continue sibling search.*/
      }
    }
  }
  throw Error(`missing real component action ${action}`);
}
function click(p: AnnotationsPanelProps, action: string) {
  const control = event(AnnotationsPanel(p), action);
  expect(control.disabled).not.toBe(true);
  (control.onClick as () => void)();
}
test("current list and editor retain author/source/constraint/revision and orphan provenance as escaped plaintext", () => {
  const html = renderToStaticMarkup(<AnnotationsPanel {...props()} />);
  for (const text of [
    "作者",
    "Agent",
    "Constraint",
    "r3",
    "Orphaned; knowledge retained",
    "src/gone.ts",
    "domain:gone",
    "s0",
    "s1",
  ])
    expect(html).toContain(text);
  expect(html).toContain("&lt;script&gt;retained&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Current annotations");
});
test.each(["en", "zh"] as const)(
  "%s editor exposes accessible author/content/constraint labels and distinct deletion/binding controls",
  (locale) => {
    const html = renderToStaticMarkup(
      <AnnotationsPanel {...props()} locale={locale} />,
    );
    expect(html).toContain(locale === "zh" ? "作者" : "Author");
    expect(html).toContain(
      locale === "zh" ? "作为约束" : "Treat as a constraint",
    );
    expect(html).toContain('data-action="delete-open"');
    expect(html).toContain('data-action="detach"');
    expect(html).toContain('data-action="use-selection"');
  },
);
test("read failure and unknown capture do not fabricate an orphan or erase editable retained text", () => {
  const p = props();
  p.page = { scope, status: "error", error: "offline" };
  const html = renderToStaticMarkup(<AnnotationsPanel {...p} />);
  expect(html).toContain("Could not load annotations");
  expect(html).toContain('data-action="retry-list"');
  expect(html).not.toContain("Orphaned; knowledge retained");
  expect(html).toContain("&lt;script&gt;retained&lt;/script&gt;");
  const note = detail();
  note.annotation.binding!.state = "bound";
  delete (note.annotation.binding as { orphanedAtSnapshotId?: string })
    .orphanedAtSnapshotId;
  note.resolution = { status: "unknown", reason: "capture unavailable" };
  p.page = {
    scope,
    status: "ready",
    value: { items: [note], total: 1, offset: 0, limit: 20, truncated: false },
  };
  expect(renderToStaticMarkup(<AnnotationsPanel {...p} />)).toContain(
    "Unknown capture",
  );
});
test("foreign epoch/project page and history cannot leak stale records into the active project", () => {
  const p = props();
  p.scope = {
    projectId: "other",
    snapshotId: "other:s",
    epoch: 2,
    selectionVersion: 0,
  };
  const html = renderToStaticMarkup(<AnnotationsPanel {...p} />);
  expect(html).not.toContain("作者");
  expect(html).not.toContain("retained");
  expect(html).toContain("Loading");
});
test("pending prevents duplicate mutations and confirmation but allows later independent body edits", () => {
  const p = props();
  p.state = beginAnnotationRequest(
    changeAnnotationDraft(p.state, { text: "changed" }),
    "save",
  ).state;
  const root = AnnotationsPanel(p);
  for (const action of ["save", "delete-open", "detach", "use-selection"])
    expect(event(root, action).disabled).toBe(true);
  expect(event(root, "text").disabled).not.toBe(true);
  expect(renderToStaticMarkup(root)).toContain("Saving");
});
test("explicit selected fact preview retains exact same-name identity; confirmation emits binding CAS only", () => {
  let p = props();
  const requests: AnnotationRequest[] = [];
  p = {
    ...p,
    selection: { snapshot, target: { kind: "node", id: "domain:b" } },
    onState: (next) => {
      p = { ...p, state: next };
    },
    onRequest: (request) => requests.push(request),
  };
  click(p, "use-selection");
  expect(requests).toEqual([]);
  const html = renderToStaticMarkup(<AnnotationsPanel {...p} />);
  expect(html).toContain("src/b.ts");
  expect(html).toContain("domain:b");
  expect(html).toContain("s1");
  click(p, "confirm-binding");
  expect(requests).toMatchObject([
    {
      kind: "bind",
      projectId: "p",
      annotationId: "note:a",
      input: {
        expectedRevision: 3,
        target: { kind: "node", id: "domain:b" },
        snapshotId: "s1",
      },
    },
  ]);
  expect(requests[0]!.input).not.toHaveProperty("text");
});
test("cancel binding and cancel deletion produce no request, while confirmed delete uses the note's exact revision", () => {
  let p = props();
  const requests: AnnotationRequest[] = [];
  p = {
    ...p,
    state: prepareAnnotationCandidate(p.state, snapshot, {
      kind: "relation",
      id: "call:a-b",
    }),
    selection: { snapshot, target: { kind: "relation", id: "call:a-b" } },
    onState: (next) => {
      p = { ...p, state: next };
    },
    onRequest: (request) => requests.push(request),
  };
  click(p, "cancel-binding");
  click(p, "delete-open");
  expect(renderToStaticMarkup(<AnnotationsPanel {...p} />)).toContain(
    "Delete this annotation?",
  );
  click(p, "delete-cancel");
  expect(requests).toEqual([]);
  click(p, "delete-open");
  click(p, "delete-confirm");
  expect(requests).toMatchObject([
    { kind: "delete", annotationId: "note:a", input: { expectedRevision: 3 } },
  ]);
});
test("a new unbound editor submits independent user note content without any planning callback", () => {
  let p = props();
  const requests: AnnotationRequest[] = [];
  p = {
    ...p,
    state: changeAnnotationDraft(createAnnotationEditor(scope, "User"), {
      text: "independent",
      author: "architect",
      isConstraint: true,
    }),
    onState: (next) => {
      p = { ...p, state: next };
    },
    onRequest: (request) => requests.push(request),
  };
  const form = event(AnnotationsPanel(p), "save-form");
  (form.onSubmit as (e: { preventDefault: () => void }) => void)({
    preventDefault: () => {},
  });
  expect(requests).toMatchObject([
    {
      kind: "create",
      projectId: "p",
      input: {
        text: "independent",
        author: "architect",
        source: "user",
        isConstraint: true,
        binding: null,
      },
    },
  ]);
});
test("pagination and history callbacks carry explicit project/scope and no mutation payload", () => {
  let p = props();
  const reads: unknown[] = [];
  p = {
    ...p,
    page: {
      scope,
      status: "ready",
      value: {
        items: [detail()],
        total: 41,
        offset: 0,
        limit: 20,
        truncated: true,
        snapshotId: "s1",
      },
    },
    onList: (r) => reads.push(r),
    onHistory: (r) => reads.push(r),
  };
  click(p, "next-page");
  click(p, "history");
  expect(reads).toEqual([
    { projectId: "p", scope, input: { offset: 20, limit: 20 } },
    {
      projectId: "p",
      scope,
      annotationId: "note:a",
      input: { offset: 0, limit: 20 },
    },
  ]);
});
test("historical revision and approved-context sources remain readonly and clearly separate from current knowledge", () => {
  const historical = detail().annotation;
  const html = renderToStaticMarkup(
    <AnnotationHistoryView
      scope={scope}
      locale="en"
      history={{
        scope,
        annotationId: "note:a",
        status: "ready",
        value: {
          items: [
            {
              annotation: historical,
              action: "orphan",
              recordedAt: "2026-10-10T00:00:00.000Z",
            },
          ],
          total: 1,
          offset: 0,
          limit: 20,
          truncated: false,
        },
      }}
      approved={{
        scope,
        approvalId: "approval:a",
        contextStatus: "v1",
        context: {
          version: 1,
          projectId: "p",
          snapshotId: "s0",
          annotations: [historical],
        },
      }}
    />,
  );
  for (const text of [
    "Revision history",
    "Recorded approval context",
    "approval:a",
    "s0",
    "作者",
    "Agent",
    "r3",
    "domain:gone",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("<input");
  expect(html).not.toContain("<textarea");
  expect(html).not.toContain("Current annotations");
});
test("legacy unrecorded approval context is explicit and cannot masquerade as an empty v1 snapshot", () => {
  const html = renderToStaticMarkup(
    <AnnotationHistoryView
      scope={scope}
      locale="en"
      approved={{ scope, approvalId: "legacy", contextStatus: "legacy" }}
    />,
  );
  expect(html).toContain("Historical annotation context was not recorded");
  expect(html).not.toContain("No recorded annotations");
});

test("selection changing without reusing a candidate cannot confirm the previously previewed fact", () => {
  const p = props();
  p.state = prepareAnnotationCandidate(p.state, snapshot, {
    kind: "node",
    id: "domain:a",
  });
  p.selection = { snapshot, target: { kind: "node", id: "domain:b" } };
  const html = renderToStaticMarkup(<AnnotationsPanel {...p} />);
  expect(html).not.toContain('data-action="confirm-binding"');
});
test("malformed page or revision rows report read failure rather than crash or fake an empty/orphan state", () => {
  const p = props();
  p.page = {
    scope,
    status: "ready",
    value: {
      items: [null as never],
      total: 1,
      offset: 0,
      limit: 20,
      truncated: false,
    },
  };
  expect(renderToStaticMarkup(<AnnotationsPanel {...p} />)).toContain(
    "Could not load annotations",
  );
  expect(
    renderToStaticMarkup(
      <AnnotationHistoryView
        scope={scope}
        locale="en"
        history={{
          scope,
          annotationId: "note:a",
          status: "ready",
          value: {
            items: [null as never],
            total: 1,
            offset: 0,
            limit: 20,
            truncated: false,
          },
        }}
      />,
    ),
  ).toContain("Could not load revision history");
});

test("read-only approved context shows its actual protocol version rather than blending into current records", () => {
  const html = renderToStaticMarkup(
    <AnnotationHistoryView
      scope={scope}
      locale="en"
      approved={{
        scope,
        approvalId: "a",
        contextStatus: "v1",
        context: {
          version: 1,
          projectId: "p",
          snapshotId: "s0",
          annotations: [],
        },
      }}
    />,
  );
  expect(html).toContain("Context version: 1");
});
test("new-node selection preview distinguishes file and folder kinds before user confirmation", () => {
  for (const [id, kind] of [
    ["file:a", "file"],
    ["folder:src", "folder"],
  ] as const) {
    const p = props();
    p.selection = { snapshot, target: { kind: "node", id } };
    p.state = prepareAnnotationCandidate(p.state, snapshot, p.selection.target);
    const html = renderToStaticMarkup(<AnnotationsPanel {...p} />);
    expect(html).toContain(`node (${kind})`);
    expect(html).toContain(id);
  }
});
test("losing a create candidate cannot smuggle its old binding into an explicit unbound save", () => {
  let p = props();
  const requests: AnnotationRequest[] = [];
  p = {
    ...p,
    state: prepareAnnotationCandidate(
      changeAnnotationDraft(createAnnotationEditor(scope, "User"), {
        text: "unbound chosen",
      }),
      snapshot,
      { kind: "node", id: "domain:a" },
    ),
    onRequest: (request) => requests.push(request),
  };
  const form = event(AnnotationsPanel(p), "save-form");
  (form.onSubmit as (e: { preventDefault: () => void }) => void)({
    preventDefault: () => {},
  });
  expect(requests).toMatchObject([
    { kind: "create", input: { text: "unbound chosen", binding: null } },
  ]);
});
