import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CodeNode } from "@codemap/core";
import { dictionaries, type Locale } from "../../i18n/index.js";
import type { GraphNode, GroupCardData } from "../graph/projection.js";
import "./group-graph.css";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className="group-chevron"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      data-open={open || undefined}
    >
      <path
        d={open ? "M12 10L8.7 6.7a1 1 0 0 0-1.4 0L4 10" : "M4 6l3.3 3.3a1 1 0 0 0 1.4 0L12 6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GroupCardContent({
  group,
  locale,
  onToggle,
  onSelect,
  ports = false,
  ownershipEnabled = false,
  onOwnershipStart,
  onOwnershipEnd,
}: {
  group: GroupCardData;
  locale: Locale;
  onToggle: (id: string) => void;
  onSelect: (node: CodeNode) => void;
  ports?: boolean;
  ownershipEnabled?: boolean;
  onOwnershipStart?: (node: CodeNode) => string | undefined;
  onOwnershipEnd?: () => void;
}) {
  const text = dictionaries[locale];
  return (
    <div className="group-card-content">
      <div className="group-card-header">
        <button
          className="group-toggle nodrag nopan"
          type="button"
          aria-label={`${group.collapsed ? text.expandGroup : text.collapseGroup} ${group.title}`}
          aria-expanded={!group.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(group.id);
          }}
        >
          <Chevron open={!group.collapsed} />
        </button>
        <strong title={group.title}>{group.title}</strong>
      </div>
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
                    draggable={ownershipEnabled && node.kind === "function"}
                    onDragStart={(event) => {
                      if (!ownershipEnabled || node.kind !== "function") {
                        event.preventDefault();
                        return;
                      }
                      const nonce = onOwnershipStart?.(node);
                      if (!nonce) {
                        event.preventDefault();
                        return;
                      }
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        "application/x-atlas-ownership",
                        nonce,
                      );
                    }}
                    onDragEnd={onOwnershipEnd}
                    title={`${node.name} · ${node.filePath ?? node.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(node);
                    }}
                  >
                    <span className="group-endpoint-name">{node.name}</span>
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
        ownershipEnabled={!!data.ownershipMode && !!data.ownershipEnabled}
        onOwnershipStart={
          data.onOwnershipStart as
            ((node: CodeNode) => string | undefined) | undefined
        }
        onOwnershipEnd={data.onOwnershipEnd as (() => void) | undefined}
      />
    </div>
  );
}
