import type { Edge } from "@xyflow/react";

import { joinIds } from "../../agents/lib/agent-assets";
import type { AgentDraft, FlowRecord, StudioFlowNode, StudioNodeData } from "../components/flow-studio-types";
import type { BackendAgentDetail, BackendFlow, BackendFlowDefinition, BackendFlowNode } from "./flow-api";
import { getFlowStudioNodeConfig, type FlowStudioNodeKind } from "./node-config";

export const splitPromptLines = (value: string) =>
  value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const joinPromptLines = (value?: string[]) => (value ?? []).join("\n");

export const emptyAgentDraft: AgentDraft = {
  name: "",
  description: "",
  instructions: "",
  model: "",
  temperature: "",
  toolIds: "",
  skillIds: "",
  knowledgeIds: "",
  stream: false,
  debug: false,
};

export const agentDetailToDraft = (agent: BackendAgentDetail): AgentDraft => ({
  name: agent.name,
  description: agent.description ?? "",
  instructions: agent.instructions ?? "",
  model: agent.model_config.model ?? "",
  temperature:
    agent.model_config.temperature == null ? "" : String(agent.model_config.temperature),
  toolIds: joinIds(agent.tool_ids),
  skillIds: joinIds(agent.skill_ids),
  knowledgeIds: joinIds(agent.knowledge_ids),
  stream: Boolean(agent.stream),
  debug: Boolean(agent.debug),
});

export const formatBackendTime = (value?: string | null) => {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const getNodeStyle = (kind: FlowStudioNodeKind) => ({
  background: getFlowStudioNodeConfig(kind).color,
  borderRadius: 14,
  border: "1px solid rgba(54, 65, 83, 0.12)",
});

export const backendFlowToRecord = (flow: BackendFlow): FlowRecord => {
  const resources = flow.definition.nodes
    .filter(
      (node): node is Extract<BackendFlowNode, { type: "agent" | "team" }> =>
        node.type === "agent" || node.type === "team",
    )
    .map((node) => node.data.label);
  const types = Array.from(new Set(flow.definition.nodes.map((node) => node.type)));
  const inferredFlowType =
    flow.flow_type ??
    (types.includes("team") ||
    flow.definition.nodes.filter((node) => node.type === "agent").length > 1
      ? "team"
      : "agent");

  return {
    id: flow.id,
    name: flow.name,
    flowType: inferredFlowType,
    status: flow.status === "published" ? "published" : "draft",
    isExposed: flow.is_exposed,
    isPrimary: flow.is_primary,
    latestVersion: flow.latest_version,
    updatedAt: formatBackendTime(flow.updated_at ?? flow.created_at),
    resources,
    types,
    description: flow.description || "本地后端 Flow",
    definition: flow.definition,
  };
};

export const backendNodeToStudioNode = (node: BackendFlowNode): StudioFlowNode => {
  if (node.type === "agent") {
    return {
      id: node.id,
      type: "studio",
      position: node.position,
      data: {
        kind: "agent",
        label: node.data.label,
        agentName: node.data.label,
        agentId: node.data.agent_binding.agent_id,
        maxRetry: node.data.max_retry ?? 0,
        onFail: node.data.on_fail ?? "",
      },
      style: getNodeStyle("agent"),
    };
  }

  if (node.type === "team") {
    return {
      id: node.id,
      type: "studio",
      position: node.position,
      data: {
        kind: "team",
        label: node.data.label,
        teamId: node.data.team_id ?? undefined,
        teamName: node.data.label,
        teamDescription: node.data.description ?? "",
        teamStrategy: node.data.strategy,
        memberAgentIds: node.data.member_agent_ids,
        memberCount: node.data.member_agent_ids.length,
        maxRetry: node.data.max_retry ?? 0,
        onFail: node.data.on_fail ?? "",
      },
      style: getNodeStyle("team"),
    };
  }

  if (node.type === "condition") {
    return {
      id: node.id,
      type: "studio",
      position: node.position,
      data: {
        kind: "condition",
        label: node.data.label,
        conditionType: node.data.condition_type ?? "simple",
        inputSource: node.data.input_source ?? "{{input.user_message}}",
        expression: node.data.expression ?? undefined,
        llmConfig: node.data.llm_config
          ? {
              model: node.data.llm_config.model,
              prompt: node.data.llm_config.prompt ?? "",
              categories: node.data.llm_config.categories ?? [],
            }
          : undefined,
        regexPatterns: node.data.regex_patterns?.map((pattern) => ({
          pattern: pattern.pattern,
          branchId: pattern.branch_id,
        })),
        jsonSchema: node.data.json_schema ?? undefined,
        branches: node.data.branches?.map((branch) => ({
          id: branch.id,
          label: branch.label,
          conditionValue: branch.condition_value ?? undefined,
          targetNodeId: branch.target_node_id ?? undefined,
        })),
        defaultBranchId: node.data.default_branch_id ?? undefined,
      },
      style: getNodeStyle("condition"),
    };
  }

  return {
    id: node.id,
    type: "studio",
    position: node.position,
    data: {
      kind: node.type,
      label: node.data.label ?? (node.type === "start" ? "Start" : "End"),
    },
    style: getNodeStyle(node.type),
  };
};

export const createNodesFromDefinition = (definition: BackendFlowDefinition): StudioFlowNode[] =>
  definition.nodes.map(backendNodeToStudioNode);

export const createEdgesFromDefinition = (definition: BackendFlowDefinition): Edge[] =>
  definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.source_handle ?? undefined,
    targetHandle: edge.target_handle ?? undefined,
    data: edge.data,
    animated: edge.data?.branch === "failure",
    className: edge.data?.branch === "failure" ? "flow-edge-failure" : undefined,
  }));

export const nodesToBackendDefinition = (nodes: StudioFlowNode[], edges: Edge[]): BackendFlowDefinition => ({
  nodes: nodes.map((node): BackendFlowNode => {
    if (node.data.kind === "agent") {
      return {
        id: node.id,
        type: "agent",
        position: node.position,
        data: {
          label: node.data.label,
          agent_binding: { agent_id: node.data.agentId ?? "" },
          input_mapping: { user_message: "{{input.user_message}}" },
          output_mapping: { result: "{{output}}" },
          max_retry: node.data.maxRetry ?? 0,
          on_fail: node.data.onFail || null,
        },
      };
    }

    if (node.data.kind === "team") {
      return {
        id: node.id,
        type: "team",
        position: node.position,
        data: {
          label: node.data.label,
          team_id: node.data.teamId ?? null,
          description: node.data.teamDescription ?? null,
          member_agent_ids: node.data.memberAgentIds ?? [],
          strategy: node.data.teamStrategy ?? "parallel",
          input_mapping: { user_message: "{{input.user_message}}" },
          output_mapping: { result: "{{output}}" },
          max_retry: node.data.maxRetry ?? 0,
          on_fail: node.data.onFail || null,
        },
      };
    }

    if (node.data.kind === "condition") {
      return {
        id: node.id,
        type: "condition",
        position: node.position,
        data: {
          label: node.data.label,
          condition_type: node.data.conditionType ?? "simple",
          input_source: node.data.inputSource ?? "{{input.user_message}}",
          expression: node.data.expression ?? null,
          llm_config: node.data.llmConfig
            ? {
                model: node.data.llmConfig.model || "gpt-4.1-mini",
                prompt: node.data.llmConfig.prompt || null,
                categories: node.data.llmConfig.categories ?? [],
                output_key: "category",
              }
            : null,
          regex_patterns: (node.data.regexPatterns ?? []).map((pattern: { pattern: string; branchId: string }) => ({
            pattern: pattern.pattern,
            branch_id: pattern.branchId,
          })),
          json_schema: (node.data.jsonSchema as Record<string, unknown>) ?? {},
          branches: (node.data.branches ?? []).map((branch: NonNullable<StudioNodeData["branches"]>[number]) => ({
            id: branch.id,
            label: branch.label,
            condition_value: branch.conditionValue ?? null,
            target_node_id: branch.targetNodeId ?? null,
          })),
          default_branch_id: node.data.defaultBranchId ?? null,
          condition:
            node.data.conditionType === "simple"
              ? {
                  field: "input.user_message",
                  operator: "contains",
                  value: node.data.label,
                }
              : null,
        },
      };
    }

    return {
      id: node.id,
      type: node.data.kind,
      position: node.position,
      data: { label: node.data.label },
    };
  }),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    source_handle: edge.sourceHandle ?? undefined,
    target_handle: edge.targetHandle ?? undefined,
    data: (edge.data ?? {}) as Record<string, unknown>,
  })),
});
