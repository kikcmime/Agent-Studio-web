"use client";

import { addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { useEffect, useMemo } from "react";

import { createTeamWrapperDefinition } from "../../agents/lib/agent-assets";
import { getFlowStudioNodeConfig, type FlowStudioNodeKind } from "../model/node-config";
import type { BackendAgent, BackendTeam } from "../model/flow-api";
import type { FlowRecord, StudioFlowNode, StudioNodeData } from "./flow-studio-types";

type UseFlowGraphEditorOptions = {
  selectedFlow: FlowRecord | undefined;
  backendAgents: BackendAgent[];
  teamOptions: BackendTeam[];
  selectedNodeId: string | null;
  setSelectedNodeId: (value: string | null) => void;
  setIsFlowSettingsOpen: (value: boolean) => void;
  setFocusNodeId: (value: string | null) => void;
  setCanvasNotice: (value: string) => void;
  setFlowError: (value: string) => void;
  nodeSelectorAnchor: { sourceNodeId: string; x: number; y: number } | null;
  setNodeSelectorAnchor: (value: { sourceNodeId: string; x: number; y: number } | null) => void;
  previewTeamNodeId: string | null;
  setPreviewTeamNodeId: (value: string | null) => void;
  updateSelectedFlow: (patch: Partial<Pick<FlowRecord, "name" | "description" | "flowType">>) => void;
  resetRunState: () => void;
  createNodesFromDefinition: (definition: FlowRecord["definition"]) => StudioFlowNode[];
  createEdgesFromDefinition: (definition: FlowRecord["definition"]) => Edge[];
};

export function useFlowGraphEditor(options: UseFlowGraphEditorOptions) {
  const {
    selectedFlow,
    backendAgents,
    teamOptions,
    selectedNodeId,
    setSelectedNodeId,
    setIsFlowSettingsOpen,
    setFocusNodeId,
    setCanvasNotice,
    setFlowError,
    setNodeSelectorAnchor,
    previewTeamNodeId,
    setPreviewTeamNodeId,
    updateSelectedFlow,
    resetRunState,
    createNodesFromDefinition,
    createEdgesFromDefinition,
  } = options;

  const [nodes, setNodes, onNodesChange] = useNodesState<StudioFlowNode>(
    selectedFlow ? createNodesFromDefinition(selectedFlow.definition) : [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    selectedFlow ? createEdgesFromDefinition(selectedFlow.definition) : [],
  );

  useEffect(() => {
    if (!selectedFlow) {
      setNodes([]);
      setEdges([]);
      setPreviewTeamNodeId(null);
      setSelectedNodeId(null);
      setFocusNodeId(null);
      return;
    }

    setNodes(createNodesFromDefinition(selectedFlow.definition));
    setEdges(createEdgesFromDefinition(selectedFlow.definition));
    setPreviewTeamNodeId(null);
    const initialAgentNode = selectedFlow.definition.nodes.find((node) => node.type === "agent")?.id ?? null;
    setSelectedNodeId(null);
    setIsFlowSettingsOpen(true);
    setFocusNodeId(initialAgentNode);
    resetRunState();
  }, [
    createEdgesFromDefinition,
    createNodesFromDefinition,
    resetRunState,
    selectedFlow,
    setEdges,
    setFocusNodeId,
    setIsFlowSettingsOpen,
    setNodes,
    setPreviewTeamNodeId,
    setSelectedNodeId,
  ]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden:
          edge.data?.branch === "failure"
            ? !(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId))
            : false,
      })),
    [edges, selectedNodeId],
  );

  const updateSelectedNode = (patch: Partial<StudioNodeData>) => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node,
      ),
    );
  };

  const onConnect = (connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const isFailureBackflow = Boolean(
      sourceNode && targetNode && targetNode.position.x <= sourceNode.position.x,
    );

    setEdges((current) =>
      addEdge(
        {
          ...connection,
          animated: isFailureBackflow,
          className: isFailureBackflow ? "flow-edge-failure" : undefined,
          data: isFailureBackflow ? { branch: "failure" } : { branch: "success" },
        },
        current,
      ),
    );

    if (isFailureBackflow && connection.source && connection.target) {
      setNodes((current) =>
        current.map((node) =>
          node.id === connection.source
            ? {
                ...node,
                data: {
                  ...node.data,
                  onFail: connection.target ?? undefined,
                  maxRetry: node.data.maxRetry ?? 3,
                },
              }
            : node,
        ),
      );
      setCanvasNotice("已创建失败回流线");
    }
  };

  const addNode = (kind: FlowStudioNodeKind, sourceNodeId?: string) => {
    if (!selectedFlow) {
      setFlowError("请先从后端创建或打开一个 Flow，再添加节点。");
      return;
    }

    const id = `${selectedFlow.id}_${kind}_${Date.now()}`;
    const config = getFlowStudioNodeConfig(kind);
    const sourceNode = sourceNodeId ? nodes.find((node) => node.id === sourceNodeId) : null;
    const siblingCount = sourceNodeId ? edges.filter((edge) => edge.source === sourceNodeId).length : 0;
    const parallelOffset =
      siblingCount === 0 ? 0 : (siblingCount % 2 === 1 ? 1 : -1) * Math.ceil(siblingCount / 2) * 82;
    let createdNode: Node<StudioNodeData> | null = null;

    setNodes((current) => {
      createdNode = {
        id,
        type: "studio",
        position: {
          x: sourceNode ? sourceNode.position.x + 260 : 160 + (current.length % 4) * 210,
          y: sourceNode ? sourceNode.position.y + parallelOffset : 120 + Math.floor(current.length / 4) * 120,
        },
        data: {
          kind,
          label:
            kind === "agent"
              ? (backendAgents[0]?.name ?? "Agent Node")
              : kind === "team"
                ? (teamOptions[0]?.name ?? "Agent Team")
                : config.label,
          agentName: kind === "agent" ? backendAgents[0]?.name : undefined,
          agentId: kind === "agent" ? backendAgents[0]?.id : undefined,
          teamId: kind === "team" ? teamOptions[0]?.id : undefined,
          teamName: kind === "team" ? teamOptions[0]?.name : undefined,
          teamDescription:
            kind === "team"
              ? (teamOptions[0]?.description ??
                "并列执行一组已有 Agent，适合处理 todo list 拆分后的同级任务。")
              : undefined,
          teamStrategy: kind === "team" ? (teamOptions[0]?.strategy ?? "parallel") : undefined,
          memberAgentIds:
            kind === "team"
              ? (teamOptions[0]?.member_agent_ids ?? backendAgents.slice(0, 2).map((agent) => agent.id))
              : undefined,
          memberCount: kind === "team" ? (teamOptions[0]?.member_agent_ids?.length ?? 0) : undefined,
        },
        style: {
          background: config.color,
          borderRadius: 14,
          border: "1px solid rgba(54, 65, 83, 0.12)",
        },
      };

      return [...current, createdNode];
    });

    if (sourceNodeId) {
      setEdges((current) =>
        addEdge(
          {
            id: `edge_${sourceNodeId}_${id}`,
            source: sourceNodeId,
            target: id,
            animated: false,
            data: { branch: "success" },
          },
          current,
        ),
      );
    }

    if (
      kind === "team" ||
      (kind === "agent" && nodes.filter((node) => node.data.kind === "agent").length >= 1)
    ) {
      updateSelectedFlow({ flowType: "team" });
    }

    setNodeSelectorAnchor(null);
    setSelectedNodeId(id);
    setIsFlowSettingsOpen(false);
    setFocusNodeId(id);
    setCanvasNotice(`${config.label} 节点已添加`);
  };

  const openNodeSelectorFromNode = (sourceNodeId: string, screenPosition: { x: number; y: number }) => {
    setSelectedNodeId(sourceNodeId);
    setIsFlowSettingsOpen(false);
    setNodeSelectorAnchor({ sourceNodeId, ...screenPosition });
  };

  const deleteNodeById = (nodeId: string) => {
    const targetNode = nodes.find((node) => node.id === nodeId);

    if (targetNode?.data.kind === "start") {
      setCanvasNotice("Start 节点不能删除");
      return;
    }

    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setCanvasNotice("已删除节点，请手动重新连接上下游");

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setFocusNodeId(null);
    }
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) {
      return;
    }

    deleteNodeById(selectedNodeId);
  };

  const previewTeamNode =
    nodes.find((node) => node.id === previewTeamNodeId && node.data.kind === "team") ?? null;
  const previewTeamRecord = previewTeamNode
    ? (teamOptions.find((team) => team.id === previewTeamNode.data.teamId) ?? {
        id: previewTeamNode.data.teamId ?? previewTeamNode.id,
        name: previewTeamNode.data.label,
        description: previewTeamNode.data.teamDescription ?? "",
        strategy: previewTeamNode.data.teamStrategy ?? "parallel",
        member_agent_ids: previewTeamNode.data.memberAgentIds ?? [],
        status: "active",
      })
    : null;
  const previewTeamDefinition = previewTeamRecord
    ? createTeamWrapperDefinition(previewTeamRecord, backendAgents)
    : null;

  return {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNode,
    visibleEdges,
    updateSelectedNode,
    onConnect,
    addNode,
    openNodeSelectorFromNode,
    deleteNodeById,
    deleteSelectedNode,
    previewTeamRecord,
    previewTeamDefinition,
  };
}
