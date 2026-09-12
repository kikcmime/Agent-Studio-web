export type Id = string;

export type FlowStatus = "draft" | "published" | "archived";
export type FlowType = "agent" | "team";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ResourceType = "mcp_server" | "knowledge_base" | "external_tool";
export type NodeType = "start" | "agent" | "team" | "condition" | "end";

export type Position = {
  x: number;
  y: number;
};

export type AgentBinding = {
  agent_id: Id;
  agent_version?: number | null;
};

export type ConditionRule = {
  field: string;
  operator: string;
  value: unknown;
};

export type ConditionBranch = {
  id: string;
  label: string;
  condition_value?: string | null;
  target_node_id?: string | null;
};

export type LLMClassifyConfig = {
  model: string;
  prompt?: string | null;
  categories: string[];
  output_key: string;
};

export type RegexPattern = {
  pattern: string;
  branch_id: string;
};

export type StartNode = {
  id: Id;
  type: "start";
  position: Position;
  data: {
    label?: string | null;
  };
};

export type AgentNode = {
  id: Id;
  type: "agent";
  position: Position;
  data: {
    label: string;
    agent_binding: AgentBinding;
    input_mapping: Record<string, unknown>;
    output_mapping: Record<string, unknown>;
    max_retry?: number;
    on_fail?: string | null;
  };
};

export type TeamNode = {
  id: Id;
  type: "team";
  position: Position;
  data: {
    label: string;
    team_id?: string | null;
    description?: string | null;
    member_agent_ids: string[];
    strategy: "parallel" | "sequential";
    input_mapping: Record<string, unknown>;
    output_mapping: Record<string, unknown>;
    max_retry?: number;
    on_fail?: string | null;
  };
};

export type ConditionNode = {
  id: Id;
  type: "condition";
  position: Position;
  data: {
    label: string;
    condition_type?: "expression" | "llm_classify" | "regex" | "json_schema" | "simple";
    input_source?: string;
    expression?: string | null;
    llm_config?: LLMClassifyConfig | null;
    regex_patterns?: RegexPattern[];
    json_schema?: Record<string, unknown>;
    branches?: ConditionBranch[];
    default_branch_id?: string | null;
    condition?: ConditionRule | null;
  };
};

export type EndNode = {
  id: Id;
  type: "end";
  position: Position;
  data: {
    label?: string | null;
  };
};

export type FlowNode = StartNode | AgentNode | TeamNode | ConditionNode | EndNode;

export type FlowEdge = {
  id: Id;
  source: Id;
  target: Id;
  source_handle?: string | null;
  target_handle?: string | null;
  data?: Record<string, unknown>;
};

export type FlowDefinition = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type FlowSummary = {
  id: Id;
  name: string;
  description?: string | null;
  flow_type: FlowType;
  owner_user_id?: string | null;
  workspace_id?: string | null;
  status: FlowStatus;
  is_exposed: boolean;
  is_primary: boolean;
  latest_version: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ModelConfig = {
  provider: string;
  model: string;
  temperature?: number | null;
  extra?: Record<string, unknown>;
};

export type AgentSummary = {
  id: Id;
  name: string;
  description?: string | null;
  role?: string | null;
  status: string;
  owner_user_id?: string | null;
  workspace_id?: string | null;
  stream?: boolean;
  debug?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TeamSummary = {
  id: Id;
  name: string;
  description?: string | null;
  strategy: "parallel" | "sequential";
  member_agent_ids: string[];
  status: string;
  version?: number;
  updated_at?: string | null;
};

export type ResourceSummary = {
  id: Id;
  name: string;
  type: ResourceType;
  description?: string | null;
  status: string;
};

export type RunStep = {
  id: Id;
  node_id: Id;
  node_type: NodeType;
  status: StepStatus;
  started_at?: string | null;
  finished_at?: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string | null;
};

export type RunEvent = {
  id: Id;
  event_type: string;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

export type RunDetail = {
  id: Id;
  flow_id: Id;
  flow_version: number;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  started_at?: string | null;
  finished_at?: string | null;
  steps: RunStep[];
  events?: RunEvent[];
};

export type BackendControlPayload = {
  flow_status?: "success" | "fail" | "failed" | "retry" | null;
  status?: "success" | "fail" | "failed" | "retry" | null;
  result?: string | null;
  is_draw?: boolean;
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
