"use client";

import {
  Background,
  ControlButton,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";

import type { BackendFlowDefinition } from "../model/flow-api";
import { flowStudioNodeConfigs, getFlowStudioNodeConfig, type FlowStudioNodeKind } from "../model/node-config";
import type { StudioFlowNode } from "./flow-studio-types";

export function FlowNodeSelector(props: {
  anchor: { sourceNodeId: string; x: number; y: number } | null;
  onClose: () => void;
  onSelect: (kind: FlowStudioNodeKind, sourceNodeId: string) => void;
}) {
  const { anchor, onClose, onSelect } = props;
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!anchor) {
      return;
    }

    const close = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".flow-node-selector")) {
        return;
      }
      onClose();
    };

    const timer = window.setTimeout(() => document.addEventListener("mousedown", close), 80);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", close);
    };
  }, [anchor, onClose]);

  if (!anchor) {
    return null;
  }

  const normalizedSearch = searchText.trim().toLowerCase();
  const selectableNodes = flowStudioNodeConfigs.filter((item) => item.kind !== "start");
  const filteredNodes = normalizedSearch
    ? selectableNodes.filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(normalizedSearch),
      )
    : selectableNodes;

  return (
    <div
      className="flow-node-selector"
      style={{
        left: `min(${anchor.x + 12}px, calc(100% - 274px))`,
        top: `max(18px, min(${anchor.y - 80}px, calc(100% - 360px)))`,
      }}
    >
      <div className="flow-node-selector-header">
        <strong>添加同级/下级节点</strong>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <input
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="搜索 Agent / Team / 条件"
      />
      <div className="flow-node-selector-list">
        {filteredNodes.map((nodeType) => (
          <button
            key={nodeType.kind}
            type="button"
            onClick={() => onSelect(nodeType.kind, anchor.sourceNodeId)}
          >
            <span style={{ background: nodeType.color }}>{nodeType.label.slice(0, 1)}</span>
            <strong>{nodeType.label}</strong>
            <em>{nodeType.description}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function StudioNodeCard(
  props: NodeProps<StudioFlowNode> & {
    onAddNodeClick: (nodeId: string, screenPosition: { x: number; y: number }) => void;
    onDeleteNodeClick: (nodeId: string) => void;
    onToggleTeamMembers: (nodeId: string) => void;
    isTeamExpanded: boolean;
  },
) {
  const { id, data, selected, onAddNodeClick, onDeleteNodeClick } = props;
  const config = getFlowStudioNodeConfig(data.kind);
  const isVirtualMember = Boolean(data.isVirtualMember);
  const canConnectIn = data.kind !== "start" && !isVirtualMember;
  const canAddNext = data.kind !== "end" && !isVirtualMember;
  const canDelete = data.kind !== "start" && !isVirtualMember;

  const openNodeSelector = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onAddNodeClick(id, {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
  };

  const hint =
    data.kind === "start"
      ? "流程起点"
      : isVirtualMember
        ? "Team 成员"
        : data.kind === "condition"
          ? "条件判断"
          : data.kind === "end"
            ? "流程结束"
            : data.kind === "team"
              ? "执行 Team"
              : "执行 Agent";

  return (
    <div className={`studio-node-card studio-node-${data.kind} ${selected ? "is-selected" : ""}`}>
      {canConnectIn ? (
        <Handle
          type="target"
          position={Position.Left}
          className="studio-node-handle studio-node-handle-left"
        />
      ) : null}

      <div className="studio-node-head">
        <div className="studio-node-icon" aria-hidden="true">
          {data.kind.slice(0, 1).toUpperCase()}
        </div>
        <div className="studio-node-copy">
          <strong>{data.label}</strong>
          <span>{config.label}</span>
        </div>
      </div>

      <div className="studio-node-body">{hint}</div>

      {data.kind === "team" && !isVirtualMember ? (
        <div className="studio-node-body studio-node-team-body">
          <button
            type="button"
            className="agent-link-button"
            onClick={(event) => {
              event.stopPropagation();
              props.onToggleTeamMembers(id);
            }}
          >
            {props.isTeamExpanded ? "关闭 Team 子图" : "查看 Team 子图"}
          </button>
          <div className="studio-team-members">
            <span className="studio-team-member">{(data.memberAgentIds ?? []).length} 个成员</span>
          </div>
        </div>
      ) : null}

      <div className="studio-node-actions" onMouseDown={(event) => event.stopPropagation()}>
        {canAddNext ? (
          <button
            type="button"
            className="studio-node-action-button"
            onClick={openNodeSelector}
            aria-label="添加节点"
            title="添加节点"
          >
            +
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className="studio-node-action-button is-danger"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteNodeClick(id);
            }}
            aria-label="删除节点"
            title="删除节点"
          >
            ×
          </button>
        ) : null}
      </div>

      {canAddNext ? (
        <Handle
          type="source"
          position={Position.Right}
          className="studio-node-handle studio-node-handle-right"
        />
      ) : null}
    </div>
  );
}

export function FlowCanvas(props: {
  nodes: StudioFlowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<StudioFlowNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  onNodeClick: (_: ReactMouseEvent, node: StudioFlowNode) => void;
  onPaneClick: () => void;
  onAddNodeClick: (nodeId: string, screenPosition: { x: number; y: number }) => void;
  onDeleteNodeClick: (nodeId: string) => void;
  expandedTeamNodeIds: string[];
  onToggleTeamMembers: (nodeId: string) => void;
  focusNodeId?: string | null;
  centerSignal?: number;
}) {
  const { fitView } = useReactFlow();
  const expandedTeamNodeIdsKey = props.expandedTeamNodeIds.join("\u0000");
  const centerCanvas = useCallback(() => {
    fitView({
      duration: 300,
      padding: 0.28,
      maxZoom: 0.95,
    });
  }, [fitView]);
  const nodeTypes = useMemo(
    () => ({
      studio: (nodeProps: NodeProps<StudioFlowNode>) => (
        <StudioNodeCard
          {...nodeProps}
          onAddNodeClick={props.onAddNodeClick}
          onDeleteNodeClick={props.onDeleteNodeClick}
          onToggleTeamMembers={props.onToggleTeamMembers}
          isTeamExpanded={props.expandedTeamNodeIds.includes(nodeProps.id)}
        />
      ),
    }),
    [expandedTeamNodeIdsKey, props.onAddNodeClick, props.onDeleteNodeClick, props.onToggleTeamMembers],
  );

  useEffect(() => {
    if (!props.focusNodeId) {
      return;
    }

    const targetNode = props.nodes.find((node) => node.id === props.focusNodeId);

    if (!targetNode) {
      return;
    }

    const timer = window.setTimeout(() => {
      fitView({
        nodes: [{ id: targetNode.id }],
        duration: 300,
        padding: 0.8,
      });
    }, 30);

    return () => window.clearTimeout(timer);
  }, [fitView, props.focusNodeId, props.nodes]);

  useEffect(() => {
    if (!props.centerSignal) {
      return;
    }

    const timer = window.setTimeout(centerCanvas, 120);
    return () => window.clearTimeout(timer);
  }, [centerCanvas, props.centerSignal]);

  return (
    <ReactFlow<StudioFlowNode, Edge>
      nodes={props.nodes}
      edges={props.edges}
      onNodesChange={props.onNodesChange}
      onEdgesChange={props.onEdgesChange}
      onConnect={props.onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.28, maxZoom: 0.95 }}
      minZoom={0.25}
      maxZoom={1.2}
      onNodeClick={props.onNodeClick}
      onPaneClick={props.onPaneClick}
    >
      <Background gap={20} size={1} />
      <Controls>
        <ControlButton onClick={centerCanvas} title="回到中央" aria-label="回到中央">
          ⌖
        </ControlButton>
      </Controls>
    </ReactFlow>
  );
}

export function TeamPreviewModal(props: {
  definition: BackendFlowDefinition | null;
  title: string;
  description?: string | null;
  onClose: () => void;
  createNodesFromDefinition: (definition: BackendFlowDefinition) => StudioFlowNode[];
  createEdgesFromDefinition: (definition: BackendFlowDefinition) => Edge[];
}) {
  const previewNodes = useMemo(
    () => (props.definition ? props.createNodesFromDefinition(props.definition) : []),
    [props.createEdgesFromDefinition, props.createNodesFromDefinition, props.definition],
  );
  const previewEdges = useMemo(
    () =>
      props.definition
        ? props.createEdgesFromDefinition(props.definition).filter((edge) => edge.data?.branch !== "failure")
        : [],
    [props.createEdgesFromDefinition, props.definition],
  );

  if (!props.definition) {
    return null;
  }

  return (
    <div className="team-preview-overlay" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="team-preview-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flow-modal-header">
          <div className="team-preview-heading">
            <strong>{props.title}</strong>
            <span>{props.description || "这是当前 Team 的内部子编排视图。"}</span>
          </div>
          <button type="button" className="agent-link-button" onClick={props.onClose}>
            关闭
          </button>
        </div>
        <div className="team-preview-canvas">
          <ReactFlow<StudioFlowNode, Edge>
            nodes={previewNodes}
            edges={previewEdges}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            onInit={(instance) => {
              window.setTimeout(() => {
                instance.fitView({ padding: 0.22, maxZoom: 1 });
              }, 60);
            }}
            onPaneClick={props.onClose}
            minZoom={0.4}
            maxZoom={1.2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
          >
            <Background gap={20} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
