import type { CSSProperties } from "react";
import { MiniMap, useReactFlow } from "@xyflow/react";
import { focusTargets, type GraphNode, type GraphEdge } from "./projection.js";
export function MapPanel({
  expanded,
  onExpanded,
  selectedNodeId,
  locale,
  loaded,
  bottom = 12,
  top,
  side = "right",
  mapHeight,
  hiddenDetails = false,
  mapWidth = 420,
}: {
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  selectedNodeId?: string;
  locale: "zh" | "en";
  loaded: number;
  bottom?: number;
  top?: number;
  side?: "left" | "right";
  mapHeight?: number;
  hiddenDetails?: boolean;
  mapWidth?: number;
}) {
  const flow = useReactFlow<GraphNode, GraphEdge>();
  const text = (zh: string, en: string) => (locale === "en" ? en : zh);
  const center = () => {
    const node = focusTargets(
      flow.getNodes(),
      selectedNodeId ? { sequence: 0, nodeId: selectedNodeId } : undefined,
    )[0];
    if (node)
      void flow.setCenter(
        node.position.x + (node.measured?.width ?? 260) / 2,
        node.position.y + (node.measured?.height ?? 150) / 2,
        { zoom: flow.getZoom(), duration: 0 },
      );
  };
  return (
    <aside
      className={`graph-map-panel ${expanded ? "expanded" : "collapsed"} nowheel nopan`}
      style={{
        bottom: top === undefined ? bottom : undefined,
        top,
        width: expanded ? mapWidth : Math.min(145, mapWidth),
        height: expanded ? (mapHeight ?? 168) + 112 : undefined,
        [side]: 12,
        [side === "right" ? "left" : "right"]: "auto",
      }}
      aria-label={text("已加载图的小地图", "Map of the loaded graph")}
      onKeyDown={(event) => {
        const viewport = flow.getViewport(),
          delta = 60;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [delta, 0],
          ArrowRight: [-delta, 0],
          ArrowUp: [0, delta],
          ArrowDown: [0, -delta],
        };
        const move = moves[event.key];
        if (move) {
          event.preventDefault();
          void flow.setViewport({
            ...viewport,
            x: viewport.x + move[0],
            y: viewport.y + move[1],
          });
        }
      }}
    >
      <button
        className="map-toggle"
        onClick={() => onExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded
          ? text("收起小地图", "Collapse map")
          : text("展开小地图", "Expand map")}
      </button>
      <MiniMap<GraphNode>
        style={
          {
            width: expanded ? mapWidth : Math.min(145, mapWidth),
            height: expanded ? (mapHeight ?? 168) : 85,
            "--inspection-map-height": `${mapHeight ?? 168}px`,
          } as CSSProperties
        }
        className="inspection-minimap"
        pannable
        zoomable
        zoomStep={1.15}
        nodeStrokeWidth={3}
        nodeStrokeColor={(n) =>
          focusTargets(
            [n],
            selectedNodeId
              ? { sequence: 0, nodeId: selectedNodeId }
              : undefined,
          ).length
            ? "#6550db"
            : "transparent"
        }
        nodeColor={(n) =>
          n.data.layer === "plan"
            ? "#a687d4"
            : n.data.node.kind === "file"
              ? "#398da0"
              : n.data.node.kind === "folder"
                ? "#ca984b"
                : n.data.node.declarationKind === "class"
                  ? "#9b6ebf"
                  : "#8195aa"
        }
        onClick={(_, position) =>
          void flow.setCenter(position.x, position.y, {
            zoom: flow.getZoom(),
            duration: 0,
          })
        }
      />
      {expanded && (
        <>
          <div className="map-actions">
            <button
              aria-label={text("小地图放大", "Map zoom in")}
              onClick={() => void flow.zoomIn({ duration: 0 })}
            >
              ＋
            </button>
            <button
              aria-label={text("小地图缩小", "Map zoom out")}
              onClick={() => void flow.zoomOut({ duration: 0 })}
            >
              −
            </button>
            <button disabled={!selectedNodeId} onClick={center}>
              {text("回到选择", "Back to selection")}
            </button>
            <button
              onClick={() => void flow.fitView({ padding: 0.25, duration: 0 })}
            >
              {text("适配当前范围", "Fit loaded range")}
            </button>
          </div>
          {hiddenDetails && (
            <p role="status">
              {text(
                "引用详情暂时收起；收起小地图后恢复。",
                "Reference details are temporarily collapsed; collapse the map to restore them.",
              )}
            </p>
          )}
          <p>
            {text("当前已加载", "Currently loaded")}: {loaded}{" "}
            {text(
              "个对象 · 点击/拖动导航，滚轮缩放",
              "objects · click/drag to navigate, wheel to zoom",
            )}
          </p>
        </>
      )}
    </aside>
  );
}
