# Focus-first graph navigation

User feedback on 2026-10-08 supersedes the earlier form-first UI. The user must see what changed without searching the whole canvas. This design covers tickets UI-01 through UI-03; agent/chat work has a separate design. Autonomous design/plan execution remains authorized. Cloudflare must not restart before acceptance.

## Outcomes

- Explicit navigation and successful semantic actions focus their affected visible nodes, center their bounds and fit them with padding. Selecting a plan focuses all its operations; adding/modifying relations focuses both endpoints; removing content focuses surviving affected context. Failed, stale or superseded operations must never steal focus. Dragging, theme changes and autosave do not move the camera. Batch updates use one camera movement. Hidden affected nodes become visible by switching to the combined layer.
- Double-clicking a function or file enters a funnel: direct dependents above, selected object alone at the waist, dependencies below. Incoming calls point down to a selected function, outgoing calls point down from it. For files aggregate actual imports and actual cross-file calls to their owning files; containment is context, never a dependency. Reciprocal dependencies appear with clear directional edges; self recursion stays on the selected card. Unknown/external targets remain visibly unknown, not invented cards.
- Unrelated currently visible nodes are retained in a horizontally arranged side lane, visually secondary. Funnel query remains bounded (80 default, 300 max) and announces truncation. Related upper/lower cards move smoothly in 300ms; camera then fits related nodes, excluding side lane. Respect prefers-reduced-motion. Manual positions are not overwritten by transient funnel layout. Escape/exit returns to previous overview; fast successive navigations cancel obsolete animations/queries.
- Breadcrumbs show project > folder > file > qualified function. Every existing folder/file is clickable and focuses that scope; selecting a new planned file navigates its planned context without pretending it is indexed source. Switching scope replaces breadcrumb state. Scope graph has explicit budgets and no stale snapshot mixing.

## Architecture and compatibility

Keep core/indexer/storage/service/web boundaries and Node24/npm lock. View coordination and derived layouts live in web graph/navigation modules; file-scope/dependency query, if required, lives in server query assembly over service snapshots, not in the browser parser. No target execution, no fake resolved static calls. Layout does not invalidate plan approval. Single click selects and focuses, double click selects then builds funnel. Planned-only objects can have a funnel built from planned relations.

Extend FocusRequest to include affected domain IDs plus a sequence while preserving existing nodeId consumers where useful. Centralize affected-node detection so plan choice, edits, undo/redo and subsequent Agent updates share behavior. Derive funnel coordinates from relation direction, not lexicographic grid order. Animate React Flow node positions with requestAnimationFrame and measured card sizes; avoid CSS transform conflict with React Flow.

## Verification

RED/GREEN tests for action-to-focus and navigation races. Layout tests for asymmetric, reciprocal, cyclic, isolated graphs and containment exclusion. Actual Chromium checks assert affected node bounding boxes inside the canvas, root singleton waist and up/down placement, changed intermediate positions and settled edges; test reduced motion and double-click selection. Breadcrumb browser checks cover root/folder/file/function and planned paths. Keep prior planning lifecycle and approval semantics covered. Screenshot light/dark views and inspect them. Independent per-ticket review, then whole-plan review.

## Decisions

Use a deterministic lane algorithm rather than a new layout dependency: preserves stable ordering and is sufficient for a two-sided funnel. Broad automatic layout stays a separate backlog ticket. Persist semantic data and manual layout; funnel camera/layout are transient. The right/left form migration comes later, so these tickets preserve existing controls until the chat shell replaces them.
