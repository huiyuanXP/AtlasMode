import type { ConfigurationProjectGraph } from "@codemap/core";
import { useStrings } from "../i18n/index.js";

/** Read-only bounded capture facts; transport omissions never imply unknown ownership. */
export function ConfigurationProjectGraphPanel({
  graph,
}: {
  graph?: ConfigurationProjectGraph;
}) {
  const strings = useStrings();
  const labels = {
    resolved: strings.configurationGraphResolved,
    unconfigured: strings.configurationGraphUnconfigured,
    ambiguous: strings.configurationGraphAmbiguous,
    invalid: strings.configurationGraphInvalid,
    unavailable: strings.configurationGraphUnavailable,
    cycle: strings.configurationGraphCycle,
    budget: strings.configurationGraphBudget,
  };
  const omission = (truncated: boolean, scopes = false) =>
    truncated && (
      <p className="warning">
        {scopes
          ? strings.configurationGraphScopeSample
          : strings.configurationGraphSample}
      </p>
    );
  return (
    <details data-testid="configuration-project-graph">
      <summary>{strings.configurationGraph}</summary>
      {!graph ? (
        <p className="muted">{strings.configurationGraphUnrecorded}</p>
      ) : (
        <>
          <p className={graph.status === "partial" ? "warning" : "muted"}>
            {graph.status === "partial"
              ? strings.configurationGraphPartial
              : strings.configurationGraphComplete}
          </p>
          <p>
            {strings.configurationGraphProjects}:{" "}
            {graph.counts.observedProjects} ·{" "}
            {strings.configurationGraphReferences}:{" "}
            {graph.counts.observedReferences} ·{" "}
            {strings.configurationGraphScopes}: {graph.counts.sourceScopes}
          </p>
          <p>
            {labels.resolved}: {graph.counts.resolved} · {labels.unconfigured}:{" "}
            {graph.counts.unconfigured} · {labels.ambiguous}:{" "}
            {graph.counts.ambiguous} · {labels.invalid}: {graph.counts.invalid}
          </p>
          <details>
            <summary>
              {strings.configurationGraphRoots} ({graph.roots.length}/
              {graph.counts.observedRoots})
            </summary>
            <ul>
              {graph.roots.map((path) => (
                <li key={path}>
                  <code className="path">{path}</code>
                </li>
              ))}
            </ul>
            {omission(graph.truncated.roots)}
          </details>
          <details>
            <summary>
              {strings.configurationGraphProjects} ({graph.projects.length}/
              {graph.counts.observedProjects})
            </summary>
            <ul>
              {graph.projects.map((project) => (
                <li key={project.configPath}>
                  <code className="path">{project.configPath}</code> ·{" "}
                  {labels[project.status]}
                </li>
              ))}
            </ul>
            {omission(graph.truncated.projects)}
          </details>
          <details>
            <summary>
              {strings.configurationGraphReferences} ({graph.references.length}/
              {graph.counts.observedReferences})
            </summary>
            <ul>
              {graph.references.map((edge, index) => (
                <li key={index}>
                  <code className="path">{edge.sourceConfigPath}</code> ·{" "}
                  <code className="path">{edge.referencePathPreview}</code>
                  {edge.referencePathTruncated && (
                    <small className="warning">
                      {" "}
                      · {strings.configurationGraphTextTruncated}
                    </small>
                  )}
                  {" → "}
                  <code className="path">
                    {edge.targetConfigPath ?? "—"}
                  </code> · {labels[edge.status]}
                  {edge.reason && (
                    <p className="warning">
                      {edge.reason}
                      {edge.reasonTruncated && (
                        <small>
                          {" "}
                          · {strings.configurationGraphTextTruncated}
                        </small>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {omission(graph.truncated.references)}
          </details>
          <details>
            <summary>
              {strings.configurationGraphScopeSamples} ({graph.scopes.length}/
              {graph.counts.sourceScopes})
            </summary>
            <ul>
              {graph.scopes.map((scope) => (
                <li key={scope.sourcePath}>
                  <code className="path">{scope.sourcePath}</code> →{" "}
                  <code className="path">{scope.configPath ?? "—"}</code> ·{" "}
                  {labels[scope.status]}
                </li>
              ))}
            </ul>
            {omission(graph.truncated.scopes, true)}
          </details>
        </>
      )}
    </details>
  );
}
