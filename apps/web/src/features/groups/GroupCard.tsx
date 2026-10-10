import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CodeNode } from "@codemap/core";
import { dictionaries, type Locale } from "../../i18n/index.js";
import type { GraphNode, GroupCardData } from "../graph/projection.js";
import "./group-graph.css";
export function GroupCardContent({
  group,
  locale,
  onToggle,
  onSelect,
  ports = false,
}: {
  group: GroupCardData;
  locale: Locale;
  onToggle: (id: string) => void;
  onSelect: (node: CodeNode) => void;
  ports?: boolean;
}) {
  const text = dictionaries[locale];
  return (
    <div className="group-card-content">
      <strong title={group.title}>{group.title}</strong>
      <button
        className="nodrag nopan"
        type="button"
        aria-label={`${group.collapsed ? text.expandGroup : text.collapseGroup} ${group.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(group.id);
        }}
      >
        {group.collapsed ? text.expandGroup : text.collapseGroup}
      </button>
      <p>
        {group.loadedMembers.length} / {group.total} {text.groupLoaded} ·{" "}
        {group.unknownMembers} {text.groupNotLoaded}
      </p>
      <small>{text.groupScopeHint}</small>
      <small>
        {text.groupMirror} · {group.title}
      </small>
      {group.collapsed && (
        <>
          <p>
            {group.internalRelationIds.length} {text.groupInternalCalls} ·{" "}
            {group.plannedInternalIds.length} {text.groupInternalPlans}
          </p>
          <strong>{text.groupEndpoints}</strong>
          {group.portIds.map((id) => {
            const node = group.loadedMembers.find((member) => member.id === id);
            return (
              node && (
                <div className="group-endpoint-row" key={id}>
                  {ports && (
                    <>
                      <Handle
                        id={`target:${id}`}
                        type="target"
                        position={Position.Left}
                        isConnectable={false}
                      />
                      <Handle
                        id={`source:${id}`}
                        type="source"
                        position={Position.Right}
                        isConnectable={false}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    className="group-endpoint nodrag nopan"
                    key={id}
                    data-domain-id={id}
                    title={`${node.name} · ${node.filePath ?? node.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(node);
                    }}
                  >
                    {node.name}
                    <code>{node.filePath}</code>
                  </button>
                </div>
              )
            );
          })}
        </>
      )}
    </div>
  );
}
export function GroupCard({ data }: NodeProps<GraphNode>) {
  const group = data.group!;
  return (
    <div
      className={`group-card inspection-${data.highlight ?? "idle"}`}
      data-group-id={group.id}
      data-collapsed={group.collapsed}
    >
      <GroupCardContent
        group={group}
        locale={data.locale as Locale}
        onToggle={data.onToggleGroup as (id: string) => void}
        onSelect={data.onSelectMember as (node: CodeNode) => void}
        ports
      />
    </div>
  );
}
