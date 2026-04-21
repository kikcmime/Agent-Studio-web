const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:7000/api/v1";

type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type BackendAgent = {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  status: string;
  stream?: boolean;
  debug?: boolean;
};

export type BackendAgentDetail = BackendAgent & {
  instructions?: string | null;
  system_prompt?: string | null;
  model_config: {
    provider: string;
    model: string;
    temperature?: number | null;
    extra?: Record<string, unknown>;
  };
  tool_ids: string[];
  skill_ids: string[];
  knowledge_ids: string[];
};

export type BackendFlowNode =
  | {
      id: string;
      type: "start";
      position: { x: number; y: number };
      data: { label?: string | null };
    }
  | {
      id: string;
      type: "agent";
      position: { x: number; y: number };
      data: {
        label: string;
        agent_binding: { agent_id: string; agent_version?: number | null };
        input_mapping: Record<string, unknown>;
        output_mapping: Record<string, unknown>;
        max_retry?: number;
        on_fail?: string | null;
      };
    }
  | {
      id: string;
      type: "team";
      position: { x: number; y: number };
      data: {
        label: string;
        description?: string | null;
        member_agent_ids: string[];
        strategy: "parallel" | "sequential";
        input_mapping: Record<string, unknown>;
        output_mapping: Record<string, unknown>;
        max_retry?: number;
        on_fail?: string | null;
      };
    }
  | {
      id: string;
      type: "condition";
      position: { x: number; y: number };
      data: {
        label: string;
        condition: { field: string; operator: string; value: unknown };
      };
    }
  | {
      id: string;
      type: "end";
      position: { x: number; y: number };
      data: { label?: string | null };
    };

export type BackendFlowEdge = {
  id: string;
  source: string;
  target: string;
  source_handle?: string | null;
  target_handle?: string | null;
  data?: Record<string, unknown>;
};

export type BackendFlowDefinition = {
  nodes: BackendFlowNode[];
  edges: BackendFlowEdge[];
};

export type BackendFlowSummary = {
  id: string;
  name: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
  latest_version: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BackendFlow = BackendFlowSummary & {
  definition: BackendFlowDefinition;
};

export type BackendRunStep = {
  id: string;
  node_id: string;
  node_type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string | null;
};

export type BackendRunDetail = {
  id: string;
  flow_id: string;
  flow_version: number;
  status: string;
  output: Record<string, unknown>;
  steps: BackendRunStep[];
  events?: Array<{
    id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at?: string | null;
  }>;
};

export type BackendRunStreamEvent = {
  event: string;
  data: Record<string, unknown>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "request failed" : payload.error.message);
  }

  return payload.data;
}

export function listBackendFlows() {
  return request<BackendFlowSummary[]>("/flows");
}

export function getBackendFlow(flowId: string) {
  return request<BackendFlow>(`/flows/${flowId}`);
}

export function listBackendAgents() {
  return request<BackendAgent[]>("/agents");
}

export function getBackendAgent(agentId: string) {
  return request<BackendAgentDetail>(`/agents/${agentId}`);
}

export function updateBackendAgent(agentId: string, payload: Partial<{
  name: string;
  description: string | null;
  instructions: string | null;
  model_config: BackendAgentDetail["model_config"];
  tool_ids: string[];
  skill_ids: string[];
  knowledge_ids: string[];
  stream: boolean;
  debug: boolean;
}>) {
  return request<BackendAgentDetail>(`/agents/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createBackendFlow(payload: {
  name: string;
  description?: string;
  owner_user_id?: string;
  workspace_id?: string;
  definition: BackendFlowDefinition;
}) {
  return request<BackendFlow>("/flows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runBackendFlow(flowId: string, input: Record<string, unknown>) {
  const summary = await request<{ id: string }>(`/flows/${flowId}/runs`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return request<BackendRunDetail>(`/runs/${summary.id}`);
}

async function streamBackendRun(
  path: string,
  input: Record<string, unknown>,
  onEvent: (event: BackendRunStreamEvent) => void,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ input, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error("stream request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    chunks.forEach((chunk) => {
      const eventLine = chunk.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));

      if (!eventLine || !dataLine) {
        return;
      }

      onEvent({
        event: eventLine.replace("event:", "").trim(),
        data: JSON.parse(dataLine.replace("data:", "").trim()) as Record<string, unknown>,
      });
    });
  }
}

export function streamBackendFlowRun(
  flowId: string,
  input: Record<string, unknown>,
  onEvent: (event: BackendRunStreamEvent) => void,
) {
  return streamBackendRun(`/flows/${flowId}/runs/stream`, input, onEvent);
}

export function streamBackendAgentRun(
  agentId: string,
  input: Record<string, unknown>,
  onEvent: (event: BackendRunStreamEvent) => void,
) {
  return streamBackendRun(`/agents/${agentId}/runs/stream`, input, onEvent);
}

export { API_BASE_URL };
