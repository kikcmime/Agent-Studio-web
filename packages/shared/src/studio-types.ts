export type Id = string;

export type FlowStatus = "draft" | "published" | "archived";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ResourceType = "mcp_server" | "knowledge_base" | "external_tool";
export type NodeType = "start" | "agent" | "condition" | "end";

export type Position = {
  x: number;
  y: number;
};

export type AgentBinding = {
  agentId: Id;
  agentVersion?: number;
};

export type StartNode = {
  id: Id;
  type: "start";
  position: Position;
  data: {
    label?: string;
  };
};

export type AgentNode = {
  id: Id;
  type: "agent";
  position: Position;
  data: {
    label: string;
    agentBinding: AgentBinding;
    inputMapping: Record<string, unknown>;
    outputMapping: Record<string, unknown>;
  };
};

export type ConditionNode = {
  id: Id;
  type: "condition";
  position: Position;
  data: {
    label: string;
    condition: {
      field: string;
      operator: string;
      value: unknown;
    };
  };
};

export type EndNode = {
  id: Id;
  type: "end";
  position: Position;
  data: {
    label?: string;
  };
};

export type FlowNode = StartNode | AgentNode | ConditionNode | EndNode;

export type FlowEdge = {
  id: Id;
  source: Id;
  target: Id;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, unknown>;
};

export type FlowDefinition = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowSummary = {
  id: Id;
  name: string;
  description?: string;
  status: FlowStatus;
  latestVersion: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  extra?: Record<string, unknown>;
};

export type AgentSummary = {
  id: Id;
  name: string;
  description?: string;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

export type ResourceSummary = {
  id: Id;
  name: string;
  type: ResourceType;
  description?: string;
  status: "active" | "inactive";
};

export type RunStep = {
  id: Id;
  nodeId: Id;
  nodeType: NodeType;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string | null;
};

export type RunDetail = {
  id: Id;
  flowId: Id;
  flowVersion: number;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  steps: RunStep[];
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
