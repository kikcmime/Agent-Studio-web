import type { Edge, Node } from "@xyflow/react";

import type { BackendFlowDefinition } from "../model/flow-api";
import type { FlowStudioNodeKind } from "../model/node-config";

export type FlowRecord = {
  id: string;
  name: string;
  flowType: "agent" | "team";
  status: "draft" | "published";
  isExposed: boolean;
  isPrimary: boolean;
  latestVersion: number;
  updatedAt: string;
  resources: string[];
  types: string[];
  description: string;
  definition: BackendFlowDefinition;
};

export type StudioNodeData = {
  kind: FlowStudioNodeKind;
  label: string;
  agentName?: string;
  agentId?: string;
  teamId?: string;
  teamName?: string;
  teamDescription?: string;
  teamStrategy?: "parallel" | "sequential";
  memberAgentIds?: string[];
  maxRetry?: number;
  onFail?: string;
  conditionType?: "expression" | "llm_classify" | "regex" | "json_schema" | "simple";
  inputSource?: string;
  expression?: string;
  llmConfig?: {
    model: string;
    prompt: string;
    categories: string[];
  };
  regexPatterns?: { pattern: string; branchId: string }[];
  jsonSchema?: object;
  branches?: {
    id: string;
    label: string;
    conditionValue?: string;
    targetNodeId?: string;
  }[];
  defaultBranchId?: string;
  isVirtualMember?: boolean;
  parentTeamNodeId?: string;
  memberCount?: number;
};

export type StudioFlowNode = Node<StudioNodeData>;
export type StudioFlowEdge = Edge;

export type AgentDraft = {
  name: string;
  description: string;
  instructions: string;
  model: string;
  temperature: string;
  toolIds: string;
  skillIds: string;
  knowledgeIds: string;
  stream: boolean;
  debug: boolean;
};
