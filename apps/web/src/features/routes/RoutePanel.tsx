import type { BrowseRoute } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
export function RoutePanel({
  routes,
  routeId,
  index,
  snapshotId,
  onStep,
  busy,
}: {
  routes: BrowseRoute[];
  routeId: string;
  index: number;
  snapshotId?: string;
  onStep: (id: string, index: number) => void;
  busy: boolean;
}) {
  const zh = useStrings();
  const route = routes.find((r) => r.id === routeId),
    stale = route && route.snapshotId !== snapshotId,
    step = route?.steps[index];
  return (
    <section className="route-panel">
      <h2>{zh.routes}</h2>
      <select
        aria-label={zh.routes}
        value={routeId}
        onChange={(e) => onStep(e.target.value, 0)}
        disabled={busy}
      >
        <option value="">{zh.noRoute}</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
      <p className="muted">{zh.routeHelp}</p>
      {route && (
        <>
          <p>{route.description}</p>
          <small>
            {zh.routeSource}: {zh[route.source]} · {zh[route.kind]} · r
            {route.revision}
          </small>
          {stale && <p className="warning">{zh.routeStale}</p>}
          <ol>
            {route.steps.map((s, i) => (
              <li key={`${s.nodeId}-${i}`}>
                <button
                  className={index === i ? "active" : ""}
                  disabled={busy || !!stale}
                  onClick={() => onStep(route.id, i)}
                >
                  {i + 1}. {s.note || s.nodeId}
                </button>
              </li>
            ))}
          </ol>
          {step && (
            <p>
              {zh.note}: {step.note}
            </p>
          )}
          <div className="button-row">
            <button
              disabled={busy || !!stale || index === 0}
              onClick={() => onStep(route.id, index - 1)}
            >
              {zh.routePrev}
            </button>
            <button
              disabled={busy || !!stale || index >= route.steps.length - 1}
              onClick={() => onStep(route.id, index + 1)}
            >
              {zh.routeNext}
            </button>
            <button
              disabled={busy || !!stale || !step}
              onClick={() => onStep(route.id, index)}
            >
              {zh.focus}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
