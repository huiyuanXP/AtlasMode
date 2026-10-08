import type { CodeNode, Project } from "@codemap/core";
import { breadcrumbs, type NavigationLocation } from "./path.js";
export function Breadcrumbs({
  project,
  node,
  location,
  label,
  plannedLabel,
  scopeLabel,
  onScope,
  onFunction,
}: {
  project: Project;
  node?: CodeNode;
  location?: NavigationLocation;
  label: string;
  plannedLabel: string;
  scopeLabel?: string;
  onScope: (path: string, kind: "folder" | "file") => void;
  onFunction: (node: CodeNode) => void;
}) {
  const segments = breadcrumbs(project, node, location);
  return (
    <nav className="breadcrumbs" aria-label={label}>
      <ol>
        {segments.map((segment, i) => (
          <li key={`${segment.kind}:${segment.path}`}>
            {i > 0 && (
              <span className="breadcrumb-separator" aria-hidden="true">
                ›
              </span>
            )}
            <button
              aria-current={i === segments.length - 1 ? "location" : undefined}
              title={segment.path}
              onClick={() =>
                segment.kind === "function" && segment.node
                  ? onFunction(segment.node)
                  : onScope(segment.path, segment.kind as "folder" | "file")
              }
            >
              {segment.label}
            </button>
          </li>
        ))}
      </ol>
      {location?.planned && (
        <span className="breadcrumb-planned">{plannedLabel}</span>
      )}
      {scopeLabel && (
        <span className="breadcrumb-plan-scope">{scopeLabel}</span>
      )}
    </nav>
  );
}
