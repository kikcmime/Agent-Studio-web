"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  Background,
  ControlButton,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { createForm } from "@formily/core";
import { Field, FormProvider } from "@formily/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  flowStudioNodeConfigs,
  getFlowStudioNodeConfig,
  type FlowStudioNodeKind,
} from "../features/flow/model/node-config";
import {
  createBackendFlow,
  getBackendAgent,
  getBackendFlow,
  getBackendTeam,
  listBackendAgents,
  listBackendFlows,
  listBackendTeams,
  runBackendFlow,
  streamBackendFlowRun,
  updateBackendAgent,
  updateBackendFlow,
  type BackendAgent,
  type BackendAgentDetail,
  type BackendFlow,
  type BackendFlowDefinition,
  type BackendFlowNode,
  type BackendFlowSummary,
  type BackendRunDetail,
  type BackendRunStreamEvent,
  type BackendTeam,
} from "../features/flow/model/flow-api";

type AppId = "home" | "flow" | "agents" | "skills" | "knowledge" | "mcp";
type WindowMode = "normal" | "maximized" | "minimized";

type DesktopApp = {
  id: AppId;
  label: string;
  short: string;
  color: string;
  icon: string;
  summary: string;
};

const apps: DesktopApp[] = [
  {
    id: "home",
    label: "首页",
    short: "Home",
    color: "linear-gradient(135deg, #ff90d8, #32d7ff)",
    icon: "grid",
    summary: "项目总览、目标和版本节奏。",
  },
  {
    id: "flow",
    label: "Flow Studio",
    short: "Flow",
    color: "linear-gradient(135deg, #18181b, #4b5563)",
    icon: "ring",
    summary: "编排多 Agent 工作流，配置节点与运行路径。",
  },
  {
    id: "agents",
    label: "Agent Hub",
    short: "Agent",
    color: "linear-gradient(135deg, #0f172a, #6d7bff)",
    icon: "code",
    summary: "管理 Agent 模型、Prompt 与资源绑定。",
  },
  {
    id: "skills",
    label: "Skills",
    short: "Skill",
    color: "linear-gradient(135deg, #73a7ff, #2c7cff)",
    icon: "bag",
    summary: "维护 Skill 能力与 Agent 的调用关系。",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    short: "KB",
    color: "linear-gradient(135deg, #6ce3c0, #34b28d)",
    icon: "db",
    summary: "接入知识库、文档和索引状态。",
  },
  {
    id: "mcp",
    label: "MCP Center",
    short: "MCP",
    color: "linear-gradient(135deg, #8a8cf3, #6366f1)",
    icon: "rocket",
    summary: "配置 MCP Server、外部工具和连接能力。",
  },
];

const isAppId = (value: string | null): value is AppId =>
  Boolean(value && apps.some((app) => app.id === value));

const readQueryParam = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(key);
};

const replaceRouteQuery = (patch: Record<string, string | null>) => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  Object.entries(patch).forEach(([key, value]) => {
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

type FlowRecord = {
  id: string;
  name: string;
  flowType: "agent" | "team";
  status: "draft" | "published";
  latestVersion: number;
  updatedAt: string;
  resources: string[];
  types: string[];
  description: string;
  definition: BackendFlowDefinition;
};

type StudioNodeData = {
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
  // Condition node fields
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
  branches?: { id: string; label: string; conditionValue?: string; targetNodeId?: string }[];
  defaultBranchId?: string;
};

type StudioFlowNode = Node<StudioNodeData>;

type AgentDraft = {
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

type SelectOption = {
  label: string;
  value: string;
};

const emptyAgentDraft: AgentDraft = {
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

const splitIds = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinIds = (value?: string[]) => (value && value.length > 0 ? value.join(", ") : "");

const agentDetailToDraft = (agent: BackendAgentDetail): AgentDraft => ({
  name: agent.name,
  description: agent.description ?? "",
  instructions: agent.instructions ?? "",
  model: agent.model_config.model ?? "",
  temperature: agent.model_config.temperature == null ? "" : String(agent.model_config.temperature),
  toolIds: joinIds(agent.tool_ids),
  skillIds: joinIds(agent.skill_ids),
  knowledgeIds: joinIds(agent.knowledge_ids),
  stream: Boolean(agent.stream),
  debug: Boolean(agent.debug),
});

function TextControl(props: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
}) {
  if (props.multiline) {
    return (
      <textarea
        value={props.value ?? ""}
        onChange={(event) => props.onChange?.(event.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
      />
    );
  }

  return (
    <input
      value={props.value ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      placeholder={props.placeholder}
    />
  );
}

function SelectControl(props: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  options: SelectOption[];
}) {
  return (
    <select
      value={props.value ?? ""}
      disabled={props.disabled}
      onChange={(event) => props.onChange?.(event.target.value)}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ToggleControl(props: {
  value?: boolean;
  onChange?: (value: boolean) => void;
  label: string;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={Boolean(props.value)}
        onChange={(event) => props.onChange?.(event.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

const formatBackendTime = (value?: string | null) => {
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

const getNodeStyle = (kind: FlowStudioNodeKind) => ({
  background: getFlowStudioNodeConfig(kind).color,
  borderRadius: 14,
  border: "1px solid rgba(54, 65, 83, 0.12)",
});

const backendFlowToRecord = (flow: BackendFlow): FlowRecord => {
  const resources = flow.definition.nodes
    .filter((node): node is Extract<BackendFlowNode, { type: "agent" | "team" }> => node.type === "agent" || node.type === "team")
    .map((node) => node.data.label);
  const types = Array.from(new Set(flow.definition.nodes.map((node) => node.type)));
  const inferredFlowType = flow.flow_type ?? (types.includes("team") || flow.definition.nodes.filter((node) => node.type === "agent").length > 1 ? "team" : "agent");

  return {
    id: flow.id,
    name: flow.name,
    flowType: inferredFlowType,
    status: flow.status === "published" ? "published" : "draft",
    latestVersion: flow.latest_version,
    updatedAt: formatBackendTime(flow.updated_at ?? flow.created_at),
    resources,
    types,
    description: flow.description || "本地后端 Flow",
    definition: flow.definition,
  };
};

const backendNodeToStudioNode = (node: BackendFlowNode): Node<StudioNodeData> => {
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
      data: { kind: "condition", label: node.data.label },
      style: getNodeStyle("condition"),
    };
  }

  return {
    id: node.id,
    type: "studio",
    position: node.position,
    data: { kind: node.type, label: node.data.label ?? (node.type === "start" ? "Start" : "End") },
    style: getNodeStyle(node.type),
  };
};

const createNodesFromDefinition = (definition: BackendFlowDefinition): StudioFlowNode[] =>
  definition.nodes.map(backendNodeToStudioNode);

const createEdgesFromDefinition = (definition: BackendFlowDefinition): Edge[] =>
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

const nodesToBackendDefinition = (nodes: Node<StudioNodeData>[], edges: Edge[]): BackendFlowDefinition => ({
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
          condition: { field: "input.user_message", operator: "contains", value: node.data.label },
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

const agentSections = [
  { title: "Agent 核心", value: "Prompt、模型、Skill、MCP、知识库" },
  { title: "设计原则", value: "配置和执行分层，不和 Flow 混合" },
  { title: "后续扩展", value: "Agent 模板、版本快照、默认上下文" },
];

const skillSections = [
  { title: "当前角色", value: "先作为结构化能力描述存在" },
  { title: "绑定方式", value: "通过 Agent 绑定，不直接嵌入 Flow" },
  { title: "后续形态", value: "可进化为工具链与能力包" },
];

const knowledgeSections = [
  { title: "第一版范围", value: "文档记录、索引占位、Agent 绑定" },
  { title: "重点", value: "先把引用关系打通，不追求复杂检索链" },
  { title: "后续扩展", value: "chunk、embedding、retrieval logs" },
];

const mcpSections = [
  { title: "第一版范围", value: "注册、启用、Agent 绑定" },
  { title: "统一协议", value: "按资源 Resource 接入，不散落特殊逻辑" },
  { title: "目标", value: "先把接入点做稳，再补生态兼容" },
];

const stringifyRunOutput = (value: unknown) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "result" in value && typeof value.result === "string") {
    return value.result;
  }

  if (typeof value === "object" && "final_text" in value && typeof value.final_text === "string") {
    return value.final_text;
  }

  if (typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }

  return JSON.stringify(value, null, 2);
};

function AppGlyph({ icon }: { icon: DesktopApp["icon"] }) {
  if (icon === "grid") {
    return (
      <div className="glyph-grid">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }

  if (icon === "ring") {
    return <div className="glyph-ring" />;
  }

  if (icon === "code") {
    return <div className="glyph-code">{"</>"}</div>;
  }

  if (icon === "bag") {
    return (
      <div className="glyph-bag">
        <span />
      </div>
    );
  }

  if (icon === "db") {
    return (
      <div className="glyph-db">
        <span />
        <span />
        <span />
      </div>
    );
  }

  return <div className="glyph-rocket">✦</div>;
}

function StudioNodeCard(props: NodeProps<StudioFlowNode> & {
  onAddNodeClick: (nodeId: string, screenPosition: { x: number; y: number }) => void;
  onDeleteNodeClick: (nodeId: string) => void;
}) {
  const { id, data, selected, onAddNodeClick, onDeleteNodeClick } = props;
  const config = getFlowStudioNodeConfig(data.kind);
  const canConnectIn = data.kind !== "start";
  const canAddNext = data.kind !== "end";
  const canDelete = data.kind !== "start";

  const openNodeSelector = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onAddNodeClick(id, {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
  };

  const hint =
    data.kind === "start"
      ? "添加后续节点"
      : data.kind === "condition"
        ? "配置条件"
        : data.kind === "end"
          ? "结束节点"
          : "配置节点";

  return (
    <>
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
    </>
  );
}

function FlowNodeSelector(props: {
  anchor: { sourceNodeId: string; x: number; y: number } | null;
  onClose: () => void;
  onSelect: (kind: FlowStudioNodeKind, sourceNodeId: string) => void;
}) {
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!props.anchor) {
      return;
    }

    const close = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".flow-node-selector")) {
        return;
      }
      props.onClose();
    };

    const timer = window.setTimeout(() => document.addEventListener("mousedown", close), 80);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", close);
    };
  }, [props]);

  if (!props.anchor) {
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
        left: `min(${props.anchor.x + 12}px, calc(100% - 274px))`,
        top: `max(18px, min(${props.anchor.y - 80}px, calc(100% - 360px)))`,
      }}
    >
      <div className="flow-node-selector-header">
        <strong>添加同级/下级节点</strong>
        <button type="button" onClick={props.onClose}>
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
            onClick={() => props.onSelect(nodeType.kind, props.anchor!.sourceNodeId)}
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

function FlowCanvas(props: {
  nodes: StudioFlowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<StudioFlowNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  onNodeClick: (_: React.MouseEvent, node: StudioFlowNode) => void;
  onPaneClick: () => void;
  onAddNodeClick: (nodeId: string, screenPosition: { x: number; y: number }) => void;
  onDeleteNodeClick: (nodeId: string) => void;
  focusNodeId?: string | null;
  centerSignal?: number;
}) {
  const { fitView } = useReactFlow();
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
        />
      ),
    }),
    [props.onAddNodeClick, props.onDeleteNodeClick],
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
  }, [fitView, props.focusNodeId]);

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

function RunConsole(props: {
  title: string;
  isRunning: boolean;
  events: BackendRunStreamEvent[];
  result: BackendRunDetail | null;
  showResult?: boolean;
}) {
  const lastEvent = props.events.at(-1);

  return (
    <div className="run-console">
      <div className="run-console-header">
        <div>
          <strong>{props.title}</strong>
          <span>{props.isRunning ? "Streaming..." : lastEvent ? lastEvent.event : "等待运行"}</span>
        </div>
        <div className={`run-console-light ${props.isRunning ? "is-running" : ""}`} />
      </div>

      <div className="run-console-feed">
        {props.events.length === 0 ? (
          <p>点击运行后，这里会显示 run / step / tool / token 等事件流。</p>
        ) : (
          props.events.map((item, index) => (
            <div key={`${item.event}_${index}`} className="run-console-event">
              <span>{item.event}</span>
              <pre>{formatRunEventSummary(item)}</pre>
            </div>
          ))
        )}
      </div>

      {props.showResult !== false && props.result ? (
        <div className="run-console-result">
          <span>Final Output</span>
          <pre>{JSON.stringify(props.result.output, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function formatRunEventSummary(item: BackendRunStreamEvent) {
  const data = item.data as Record<string, unknown>;
  const output = data.output as Record<string, unknown> | undefined;

  if (item.event === "run.started") {
    return `status: ${String(data.status ?? "running")}\nrun: ${String(data.run_id ?? "-")}`;
  }

  if (item.event === "step.started") {
    return `node: ${String(data.node_id ?? "-")}\nagent: ${String(data.agent_id ?? data.node_type ?? "-")}`;
  }

  if (item.event === "step.completed") {
    const message = typeof output?.message === "string" ? output.message : "step completed";
    return trimConsoleText(message);
  }

  if (item.event === "run.completed") {
    const finalOutput = data.output as Record<string, unknown> | undefined;
    const finalText = typeof finalOutput?.final_text === "string" ? finalOutput.final_text : String(data.status ?? "completed");
    return trimConsoleText(finalText);
  }

  if (item.event === "step.failed" || item.event === "run.failed") {
    return trimConsoleText(String(data.error ?? "failed"));
  }

  return trimConsoleText(JSON.stringify(item.data, null, 2));
}

function trimConsoleText(value: string) {
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}

type HomeChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_HOME_PROMPT = "你可以帮我干啥";

function HomeFlowConsole() {
  const [flows, setFlows] = useState<BackendFlowSummary[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_HOME_PROMPT);
  const [messages, setMessages] = useState<HomeChatMessage[]>([]);
  const [events, setEvents] = useState<BackendRunStreamEvent[]>([]);
  const [result, setResult] = useState<BackendRunDetail | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const stream = chatStreamRef.current;
    if (!stream) {
      return;
    }

    stream.scrollTo({
      top: stream.scrollHeight,
      behavior,
    });
  }, []);

  const handleChatScroll = useCallback(() => {
    const stream = chatStreamRef.current;
    if (!stream) {
      return;
    }

    const distanceToBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight;
    shouldAutoScrollRef.current = distanceToBottom < 48;
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    scrollChatToBottom(isRunning ? "auto" : "smooth");
  }, [messages, isRunning, scrollChatToBottom]);

  useEffect(() => {
    let mounted = true;

    async function loadFlows() {
      try {
        const backendFlows = await listBackendFlows();

        if (!mounted) {
          return;
        }

        setFlows(backendFlows);
        setSelectedFlowId((current) => current || backendFlows[0]?.id || "");
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "读取 Flow 失败");
        }
      }
    }

    void loadFlows();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0];

  const runSelectedFlow = async () => {
    if (!selectedFlow || !prompt.trim() || isRunning) {
      return;
    }

    const userText = prompt.trim();
    const history = messages;
    const assistantMessageId = `assistant_${Date.now()}`;
    setEvents([]);
    setResult(null);
    setError("");
    setIsRunning(true);
    setPrompt("");
    shouldAutoScrollRef.current = true;
    setMessages((current) => [
      ...current,
      { id: `user_${Date.now()}`, role: "user", content: userText },
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    requestAnimationFrame(() => scrollChatToBottom("smooth"));

    try {
      let streamedResult: BackendRunDetail | null = null;

      await streamBackendFlowRun(selectedFlow.id, {
        user_message: userText,
        messages: history.map((item) => ({ role: item.role, content: item.content })),
        session_id: "home",
      }, (event) => {
        if (event.event === "token.delta") {
          const delta = typeof event.data.delta === "string" ? event.data.delta : "";
          if (delta) {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId ? { ...item, content: item.content + delta } : item,
              ),
            );
          }
          return;
        }

        if (event.event === "team.placeholder.completed") {
          const output = event.data.output as { message?: unknown } | undefined;
          const message = typeof output?.message === "string" ? output.message : "";
          if (message) {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessageId && !item.content ? { ...item, content: message } : item,
              ),
            );
          }
        }

        setEvents((current) => [...current, event]);

        if (event.event === "run.completed") {
          streamedResult = event.data as unknown as BackendRunDetail;
        }
      });

      const finalResult = streamedResult ?? (await runBackendFlow(selectedFlow.id, {
        user_message: userText,
        messages: history.map((item) => ({ role: item.role, content: item.content })),
        session_id: "home",
      }));
      setResult(finalResult);
      const finalText = stringifyRunOutput(finalResult.output);
      if (finalText) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId && !item.content ? { ...item, content: finalText } : item,
          ),
        );
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "运行 Flow 失败");
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId && !item.content
            ? { ...item, content: "运行失败，请查看右侧事件流或后端日志。" }
            : item,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="home-console">
      <div className="home-console-head">
        <div className="home-console-title">
          <span>Agent Console</span>
          <h1>{selectedFlow?.name ?? "选择一个 Flow"}</h1>
          <p>{isRunning ? "正在流式执行..." : "输入任务，交给当前编排好的 Agent 工作流处理。"}</p>
        </div>
        <div className="home-flow-actions">
          <label className="home-flow-picker">
            <span>Flow</span>
            <select
              value={selectedFlow?.id ?? ""}
              disabled={flows.length === 0 || isRunning}
              onChange={(event) => setSelectedFlowId(event.target.value)}
            >
              {flows.length === 0 ? <option value="">暂无 Flow</option> : null}
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="flow-secondary-button"
            disabled={isRunning || messages.length === 0}
            onClick={() => {
              setMessages([]);
              setEvents([]);
              setResult(null);
              setError("");
            }}
          >
            清空对话
          </button>
        </div>
      </div>

      <div className="home-console-grid">
        <div className="home-chat-panel">
          <div ref={chatStreamRef} className="home-chat-stream" onScroll={handleChatScroll}>
            {messages.length === 0 ? (
              <div className="home-message is-agent">
                <span>{selectedFlow?.name ?? "Flow Agent"}</span>
                <p>输入一个任务，我会以流式方式运行编排，并在本页面保留短期上下文。</p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className={`home-message ${message.role === "user" ? "is-user" : "is-agent"}`}>
                <span>{message.role === "user" ? "你" : selectedFlow?.name ?? "Flow Agent"}</span>
                {message.content ? <div className="home-message-content">{message.content}</div> : <p>正在生成...</p>}
              </div>
            ))}
            {error ? <p className="home-error">{error}</p> : null}
          </div>

          <form
            className="home-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void runSelectedFlow();
            }}
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="输入任务，按 Enter 发送"
            />
            <button
              type="submit"
              className="flow-primary-button"
              disabled={!selectedFlow || !prompt.trim() || isRunning}
            >
              {isRunning ? "运行中" : "发送"}
            </button>
          </form>
        </div>

        <RunConsole title="Run Timeline" isRunning={isRunning} events={events} result={result} showResult={false} />
      </div>
    </section>
  );
}

function FlowStudioContent() {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(() => readQueryParam("flow") ?? "");
  const [flowView, setFlowView] = useState<"list" | "editor">(() =>
    readQueryParam("view") === "editor" ? "editor" : "list",
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowType, setNewFlowType] = useState<"agent" | "team">("agent");
  const [backendAgents, setBackendAgents] = useState<BackendAgent[]>([]);
  const [backendTeams, setBackendTeams] = useState<BackendTeam[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFlowSettingsOpen, setIsFlowSettingsOpen] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [centerSignal, setCenterSignal] = useState(0);
  const [canvasNotice, setCanvasNotice] = useState<string>("");
  const [flowError, setFlowError] = useState<string>("");
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const [isFlowSaving, setIsFlowSaving] = useState(false);
  const [runResult, setRunResult] = useState<BackendRunDetail | null>(null);
  const [runEvents, setRunEvents] = useState<BackendRunStreamEvent[]>([]);
  const [isRunStreaming, setIsRunStreaming] = useState(false);
  const [runInputText] = useState('{"user_message":"帮我处理这个问题"}');
  const [nodeSelectorAnchor, setNodeSelectorAnchor] = useState<{ sourceNodeId: string; x: number; y: number } | null>(null);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<BackendAgentDetail | null>(null);
  const [isAgentSaving, setIsAgentSaving] = useState(false);
  const agentForm = useMemo(() => createForm({ initialValues: emptyAgentDraft }), []);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0];
  const agentOptions = backendAgents;
  const teamOptions = backendTeams;
  const updateSelectedFlow = (patch: Partial<Pick<FlowRecord, "name" | "description" | "flowType">>) => {
    if (!selectedFlow) {
      return;
    }

    setFlows((current) => current.map((flow) => (flow.id === selectedFlow.id ? { ...flow, ...patch } : flow)));
  };
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioFlowNode>(selectedFlow ? createNodesFromDefinition(selectedFlow.definition) : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(selectedFlow ? createEdgesFromDefinition(selectedFlow.definition) : []);

  useEffect(() => {
    const centerOnNormalWindow = () => setCenterSignal((value) => value + 1);

    window.addEventListener("agent-studio:center-flow", centerOnNormalWindow);
    return () => window.removeEventListener("agent-studio:center-flow", centerOnNormalWindow);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBackendSeed() {
      setIsFlowLoading(true);
      setFlowError("");

      try {
        const [backendFlows, agents, teams] = await Promise.all([listBackendFlows(), listBackendAgents(), listBackendTeams()]);

        if (!mounted) {
          return;
        }

        const backendFlowDetails = await Promise.all(backendFlows.map((flow) => getBackendFlow(flow.id)));
        const records = backendFlowDetails.map(backendFlowToRecord);
        const routeFlowId = readQueryParam("flow");
        const routeFlow = routeFlowId ? records.find((flow) => flow.id === routeFlowId) : undefined;
        setFlows(records);
        setSelectedFlowId(routeFlow?.id ?? records[0]?.id ?? "");
        setBackendAgents(agents);
        setBackendTeams(teams);
      } catch (error) {
        if (mounted) {
          setFlows([]);
          setSelectedFlowId("");
          setBackendAgents([]);
          setBackendTeams([]);
          setNodes([]);
          setEdges([]);
          setFlowError(error instanceof Error ? error.message : "本地后端暂不可用，请确认 7000 端口服务已启动。");
        }
      } finally {
        if (mounted) {
          setIsFlowLoading(false);
        }
      }
    }

    loadBackendSeed();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    replaceRouteQuery({
      app: "flow",
      view: flowView,
      flow: flowView === "editor" ? selectedFlowId : null,
    });
  }, [flowView, selectedFlowId]);

  useEffect(() => {
    if (!selectedFlow) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setFocusNodeId(null);
      return;
    }

    setNodes(createNodesFromDefinition(selectedFlow.definition));
    setEdges(createEdgesFromDefinition(selectedFlow.definition));
    const initialAgentNode = selectedFlow.definition.nodes.find((node) => node.type === "agent")?.id ?? null;
    setSelectedNodeId(null);
    setIsFlowSettingsOpen(true);
    setFocusNodeId(initialAgentNode);
    setRunResult(null);
    setRunEvents([]);
  }, [selectedFlow?.id, setEdges, setNodes]);

  useEffect(() => {
    if (!canvasNotice) {
      return;
    }

    const timer = window.setTimeout(() => setCanvasNotice(""), 1600);
    return () => window.clearTimeout(timer);
  }, [canvasNotice]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedAgentId = selectedNode?.data.kind === "agent" ? selectedNode.data.agentId : undefined;

  useEffect(() => {
    let mounted = true;

    if (!selectedAgentId) {
      setSelectedAgentDetail(null);
      agentForm.setValues(emptyAgentDraft, "overwrite");
      return;
    }
    const agentId = selectedAgentId;

    async function loadAgentDetail() {
      try {
        const detail = await getBackendAgent(agentId);
        if (!mounted) {
          return;
        }
        setSelectedAgentDetail(detail);
        agentForm.setValues(agentDetailToDraft(detail), "overwrite");
      } catch (error) {
        if (mounted) {
          setFlowError(error instanceof Error ? error.message : "读取 Agent 详情失败");
        }
      }
    }

    loadAgentDetail();

    return () => {
      mounted = false;
    };
  }, [agentForm, selectedAgentId]);

  const onConnect = (connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const isFailureBackflow = Boolean(sourceNode && targetNode && targetNode.position.x <= sourceNode.position.x);

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
    const parallelOffset = siblingCount === 0 ? 0 : (siblingCount % 2 === 1 ? 1 : -1) * Math.ceil(siblingCount / 2) * 82;
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
          label: kind === "agent" ? agentOptions[0]?.name ?? "Agent Node" : kind === "team" ? teamOptions[0]?.name ?? "Agent Team" : config.label,
          agentName: kind === "agent" ? agentOptions[0]?.name : undefined,
          agentId: kind === "agent" ? agentOptions[0]?.id : undefined,
          teamId: kind === "team" ? teamOptions[0]?.id : undefined,
          teamName: kind === "team" ? teamOptions[0]?.name : undefined,
          teamDescription: kind === "team" ? teamOptions[0]?.description ?? "并列执行一组已有 Agent，适合处理 todo list 拆分后的同级任务。" : undefined,
          teamStrategy: kind === "team" ? teamOptions[0]?.strategy ?? "parallel" : undefined,
          memberAgentIds: kind === "team" ? teamOptions[0]?.member_agent_ids ?? agentOptions.slice(0, 2).map((agent) => agent.id) : undefined,
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

    if (kind === "team" || (kind === "agent" && nodes.filter((node) => node.data.kind === "agent").length >= 1)) {
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

  const saveSelectedAgent = async () => {
    if (!selectedAgentId || !selectedAgentDetail) {
      return;
    }

    const agentDraft = {
      ...emptyAgentDraft,
      ...(agentForm.values as Partial<AgentDraft>),
    };
    const parsedTemperature = agentDraft.temperature.trim() ? Number(agentDraft.temperature) : null;
    if (parsedTemperature != null && Number.isNaN(parsedTemperature)) {
      setFlowError("temperature 需要是数字，例如 0.2");
      return;
    }

    setIsAgentSaving(true);
    setFlowError("");

    try {
      const updated = await updateBackendAgent(selectedAgentId, {
        name: agentDraft.name.trim() || selectedAgentDetail.name,
        description: agentDraft.description.trim() || null,
        instructions: agentDraft.instructions.trim() || null,
        model_config: {
          ...selectedAgentDetail.model_config,
          model: agentDraft.model.trim() || selectedAgentDetail.model_config.model,
          temperature: parsedTemperature,
        },
        tool_ids: splitIds(agentDraft.toolIds),
        skill_ids: splitIds(agentDraft.skillIds),
        knowledge_ids: splitIds(agentDraft.knowledgeIds),
        stream: agentDraft.stream,
        debug: agentDraft.debug,
      });

      setSelectedAgentDetail(updated);
      agentForm.setValues(agentDetailToDraft(updated), "overwrite");
      setBackendAgents((current) => current.map((agent) => (agent.id === updated.id ? { ...agent, ...updated } : agent)));
      updateSelectedNode({
        label: updated.name,
        agentName: updated.name,
        agentId: updated.id,
      });
      setCanvasNotice("Agent 配置已保存");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "保存 Agent 配置失败");
    } finally {
      setIsAgentSaving(false);
    }
  };

  const createFlow = async () => {
    const normalizedName = newFlowName.trim();

    if (!normalizedName) {
      return;
    }

    setIsFlowLoading(true);
    setFlowError("");

    try {
      const created = await createBackendFlow({
        name: normalizedName,
        description: newFlowDescription.trim() || "新的多 Agent 工作流，等待进入画布继续配置。",
        flow_type: newFlowType,
        owner_user_id: "local_user",
        workspace_id: "local_workspace",
        definition: nodesToBackendDefinition(nodes, edges),
      });
      const record = backendFlowToRecord(created);

      setFlows((current) => [record, ...current.filter((flow) => flow.id !== record.id)]);
      setSelectedFlowId(record.id);
      setFlowView("editor");
      setIsCreateModalOpen(false);
      setNewFlowName("");
      setNewFlowDescription("");
      setNewFlowType("agent");
      setCanvasNotice("Flow 已保存到本地后端");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "后端保存失败，请确认 7000 端口服务已启动。");
    } finally {
      setIsFlowLoading(false);
    }
  };

  const saveCurrentFlow = async () => {
    if (!selectedFlow) {
      return;
    }

    setIsFlowSaving(true);
    setFlowError("");

    try {
      const updated = await updateBackendFlow(selectedFlow.id, {
        name: selectedFlow.name,
        description: selectedFlow.description,
        flow_type: selectedFlow.flowType,
        definition: nodesToBackendDefinition(nodes, edges),
      });
      const record = backendFlowToRecord(updated);

      setFlows((current) => current.map((flow) => (flow.id === record.id ? record : flow)));
      setCanvasNotice(`Flow 已保存，版本 v${record.latestVersion}`);
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "保存 Flow 失败，请确认后端 7000 正常运行。");
    } finally {
      setIsFlowSaving(false);
    }
  };

  const isCreateDisabled = !newFlowName.trim();

  const openFlowEditor = async (flow: FlowRecord) => {
    setSelectedFlowId(flow.id);
    setFlowView("editor");
    setFlowError("");

    try {
      const detail = await getBackendFlow(flow.id);
      const record = backendFlowToRecord(detail);
      setFlows((current) => current.map((item) => (item.id === record.id ? record : item)));
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "读取 Flow 详情失败");
    }
  };

  const runCurrentFlow = async () => {
    if (!selectedFlow) {
      return;
    }

    setRunResult(null);
    setRunEvents([]);
    setFlowError("");
    setIsRunStreaming(true);

    try {
      const input = JSON.parse(runInputText) as Record<string, unknown>;
      let streamedResult: BackendRunDetail | null = null;

      await streamBackendFlowRun(selectedFlow.id, input, (event) => {
        setRunEvents((current) => [...current, event]);

        if (event.event === "run.completed") {
          streamedResult = event.data as unknown as BackendRunDetail;
        }
      });

      const result = streamedResult ?? (await runBackendFlow(selectedFlow.id, input));
      setRunResult(result);
      setCanvasNotice(`运行完成：${result.status}`);
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "运行调试失败");
    } finally {
      setIsRunStreaming(false);
    }
  };

  if (flowView === "editor" && selectedFlow) {
    return (
      <section className="workspace-canvas workspace-canvas-plain">
        <div className="content-doc content-doc-flow content-doc-flow-editor">
          <header className="flow-page-header">
            <div>
              <h2>{selectedFlow.name}</h2>
            </div>

            <div className="flow-header-actions">
              <button type="button" className="flow-secondary-button" onClick={() => setFlowView("list")}>
                返回 Flows
              </button>
              <button type="button" className="flow-secondary-button" onClick={deleteSelectedNode}>
                删除节点
              </button>
              <button type="button" className="flow-secondary-button" onClick={() => setIsCreateModalOpen(true)}>
                新建 Flow
              </button>
              <button type="button" className="flow-secondary-button" onClick={saveCurrentFlow} disabled={isFlowSaving}>
                {isFlowSaving ? "保存中..." : "保存 Flow"}
              </button>
              <button type="button" className="flow-primary-button" onClick={runCurrentFlow}>
                {isRunStreaming ? "运行中..." : "运行调试"}
              </button>
            </div>
          </header>

          {flowError ? <div className="flow-inline-alert">{flowError}</div> : null}

          <div className={`flow-editor-shell ${selectedNodeId || isFlowSettingsOpen ? 'has-panel-open' : ''}`}>
            <section className="flow-editor-canvas">
              {canvasNotice ? <div className="flow-canvas-notice">{canvasNotice}</div> : null}
              <ReactFlowProvider>
                <FlowCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => {
                    setSelectedNodeId(node.id);
                    setIsFlowSettingsOpen(false);
                  }}
                  onPaneClick={() => {
                    setSelectedNodeId(null);
                    setIsFlowSettingsOpen(true);
                    setNodeSelectorAnchor(null);
                  }}
                  onAddNodeClick={openNodeSelectorFromNode}
                  onDeleteNodeClick={deleteNodeById}
                  focusNodeId={focusNodeId}
                  centerSignal={centerSignal}
                />
              </ReactFlowProvider>
              <FlowNodeSelector
                anchor={nodeSelectorAnchor}
                onClose={() => setNodeSelectorAnchor(null)}
                onSelect={(kind, sourceNodeId) => addNode(kind, sourceNodeId)}
              />
            </section>

            <aside className={`flow-editor-panel ${selectedNodeId || isFlowSettingsOpen ? 'is-open' : ''}`}>
              <div className="config-panel-head">
                <div className="config-panel-title">
                  <strong>{selectedNode ? selectedNode.data.kind === "agent" ? "Agent 参数" : selectedNode.data.kind === "team" ? "Team 参数" : "节点配置" : "整体设置"}</strong>
                  {selectedNode ? <span>{selectedNode.data.kind} · {selectedNode.id}</span> : selectedFlow ? <span>{selectedFlow.flowType} · {selectedFlow.id}</span> : null}
                </div>
                <button
                  type="button"
                  className="panel-close-button"
                  onClick={() => {
                    setSelectedNodeId(null);
                    setIsFlowSettingsOpen(false);
                  }}
                  aria-label="关闭面板"
                >
                  ×
                </button>
              </div>
              <div className="config-panel-body">
                {selectedNode ? (
                  <>
                    <div className="config-panel-scroll">
                      <div className="node-compact-row">
                        <label className="flow-field flow-field-compact">
                          <span>节点标题</span>
                          <input
                            value={selectedNode.data.label}
                            onChange={(event) => updateSelectedNode({ label: event.target.value })}
                          />
                        </label>
                      </div>
                      {selectedNode.data.kind === "agent" ? (
                        <FormProvider form={agentForm}>
                          <div className="agent-config-form">
                            <label className="flow-field flow-field-compact">
                              <span>绑定 Agent</span>
                              <select
                                value={selectedNode.data.agentId ?? selectedNode.data.agentName ?? agentOptions[0]?.id ?? ""}
                                disabled={agentOptions.length === 0}
                                onChange={(event) =>
                                  {
                                    const agent = agentOptions.find((item) => item.id === event.target.value);
                                    updateSelectedNode({
                                      agentId: event.target.value,
                                      agentName: agent?.name ?? event.target.value,
                                      label: agent?.name ?? event.target.value,
                                    });
                                  }
                                }
                              >
                                {agentOptions.length === 0 ? <option value="">暂无后端 Agent</option> : null}
                                {agentOptions.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="agent-config-grid">
                              <label className="flow-field flow-field-compact">
                                <span>Agent 名称</span>
                                <Field name="name" component={[TextControl]} />
                              </label>
                              <label className="flow-field flow-field-compact">
                                <span>模型</span>
                                <Field name="model" component={[TextControl, { placeholder: "gpt-4.1-mini" }]} />
                              </label>
                            </div>

                            <div className="agent-config-grid">
                              <label className="flow-field flow-field-compact">
                                <span>温度</span>
                                <Field name="temperature" component={[TextControl, { placeholder: "0.2" }]} />
                              </label>
                              <label className="flow-field flow-field-compact">
                                <span>最大重试次数</span>
                                <Field name="maxRetry" component={[TextControl, { placeholder: "0" }]} />
                              </label>
                            </div>

                            <label className="flow-field flow-field-compact">
                              <span>详细指令</span>
                              <Field name="instructions" component={[TextControl, { multiline: true, rows: 3 }]} />
                            </label>

                            <label className="flow-field flow-field-compact">
                              <span>描述</span>
                              <Field name="description" component={[TextControl, { multiline: true, rows: 2 }]} />
                            </label>

                            <div className="agent-config-grid">
                              <label className="flow-field flow-field-compact">
                                <span>技能 IDs</span>
                                <Field name="skillIds" component={[TextControl, { placeholder: "skill_triage" }]} />
                              </label>
                              <label className="flow-field flow-field-compact">
                                <span>知识库 IDs</span>
                                <Field name="knowledgeIds" component={[TextControl, { placeholder: "kb_support" }]} />
                              </label>
                            </div>

                            <label className="flow-field flow-field-compact">
                              <span>工具 IDs</span>
                              <Field name="toolIds" component={[TextControl, { placeholder: "tool_search, tool_http" }]} />
                            </label>

                            <div className="agent-config-toggles">
                              <Field name="stream" component={[ToggleControl, { label: "流式输出" }]} />
                              <Field name="debug" component={[ToggleControl, { label: "调试" }]} />
                            </div>

                            <button type="button" className="flow-primary-button agent-save-button" onClick={saveSelectedAgent}>
                              {isAgentSaving ? "保存中..." : "保存 Agent"}
                            </button>
                          </div>
                        </FormProvider>
                      ) : null}
                      {selectedNode.data.kind === "team" ? (
                        <label className="flow-field flow-field-compact">
                          <span>绑定 Team</span>
                          <select
                            value={selectedNode.data.teamId ?? teamOptions[0]?.id ?? ""}
                            disabled={teamOptions.length === 0}
                            onChange={(event) => {
                              const team = teamOptions.find((item) => item.id === event.target.value);
                              updateSelectedNode({
                                teamId: event.target.value,
                                teamName: team?.name ?? event.target.value,
                                label: team?.name ?? event.target.value,
                                teamDescription: team?.description ?? "",
                                teamStrategy: team?.strategy ?? "parallel",
                                memberAgentIds: team?.member_agent_ids ?? [],
                              });
                            }}
                          >
                            {teamOptions.length === 0 ? <option value="">暂无后端 Team</option> : null}
                            {teamOptions.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {selectedNode.data.kind === "agent" || selectedNode.data.kind === "team" ? (
                        <div className="retry-config-card">
                          <div className="config-section-title">
                            <strong>失败回流</strong>
                            <span>失败时回跳</span>
                          </div>
                          <div className="agent-config-grid">
                            <label className="flow-field flow-field-compact">
                              <span>最大重试</span>
                              <input
                                type="number"
                                min={0}
                                value={selectedNode.data.maxRetry ?? 0}
                                onChange={(event) => updateSelectedNode({ maxRetry: Number(event.target.value) })}
                              />
                            </label>
                            <label className="flow-field flow-field-compact">
                              <span>失败跳转</span>
                              <select
                                value={selectedNode.data.onFail ?? ""}
                                onChange={(event) => {
                                  const targetId = event.target.value;
                                  updateSelectedNode({ onFail: targetId });
                                  setEdges((current) => {
                                    const withoutOldFailure = current.filter(
                                      (edge) => !(edge.source === selectedNode.id && edge.data?.branch === "failure"),
                                    );

                                    if (!targetId) {
                                      return withoutOldFailure;
                                    }

                                    return addEdge(
                                      {
                                        id: `edge_${selectedNode.id}_${targetId}_failure`,
                                        source: selectedNode.id,
                                        target: targetId,
                                    animated: true,
                                    className: "flow-edge-failure",
                                    data: { branch: "failure" },
                                  },
                                  withoutOldFailure,
                                );
                              });
                            }}
                          >
                            <option value="">不回流</option>
                            {nodes
                              .filter((node) => node.id !== selectedNode.id)
                              .map((node) => (
                                <option key={node.id} value={node.id}>
                                  {node.data.label}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                        </div>
                      ) : null}
                      {selectedNode.data.kind === "team" ? (
                        <div className="team-config-card">
                      <div>
                        <strong>Team 子编排</strong>
                        <p>嵌套已有 Agent，支持并行/串行。</p>
                      </div>
                      <label className="flow-field flow-field-compact">
                        <span>Team 描述</span>
                        <textarea
                          rows={2}
                          value={selectedNode.data.teamDescription ?? ""}
                          onChange={(event) => updateSelectedNode({ teamDescription: event.target.value })}
                        />
                      </label>
                      <label className="flow-field flow-field-compact">
                        <span>执行策略</span>
                        <select
                          value={selectedNode.data.teamStrategy ?? "parallel"}
                          onChange={(event) =>
                            updateSelectedNode({ teamStrategy: event.target.value as "parallel" | "sequential" })
                          }
                        >
                          <option value="parallel">parallel 并行</option>
                          <option value="sequential">sequential 串行</option>
                        </select>
                      </label>
                      <label className="flow-field flow-field-compact">
                        <span>成员 Agent IDs</span>
                        <input
                          value={joinIds(selectedNode.data.memberAgentIds)}
                          onChange={(event) => updateSelectedNode({ memberAgentIds: splitIds(event.target.value) })}
                          placeholder="agent_a, agent_b"
                        />
                      </label>
                        </div>
                      ) : null}

                      {selectedNode.data.kind === "condition" ? (
                        <div className="condition-config-card">
                          <div className="config-section-title">
                            <strong>条件分支配置</strong>
                            <span>根据条件路由到不同分支</span>
                          </div>

                          <label className="flow-field flow-field-compact">
                            <span>条件类型</span>
                            <select
                              value={selectedNode.data.conditionType ?? "expression"}
                              onChange={(event) =>
                                updateSelectedNode({
                                  conditionType: event.target.value as StudioNodeData["conditionType"],
                                  branches: [{ id: "branch_1", label: "分支 1", conditionValue: "" }, { id: "branch_2", label: "分支 2", conditionValue: "" }],
                                  defaultBranchId: "branch_2",
                                })
                              }
                            >
                              <option value="expression">表达式</option>
                              <option value="llm_classify">LLM 分类</option>
                              <option value="regex">正则匹配</option>
                              <option value="json_schema">JSON Schema</option>
                            </select>
                          </label>

                          <label className="flow-field flow-field-compact">
                            <span>输入来源</span>
                            <input
                              value={selectedNode.data.inputSource ?? "{{input.user_message}}"}
                              onChange={(event) => updateSelectedNode({ inputSource: event.target.value })}
                              placeholder="{{input.user_message}}"
                            />
                          </label>

                          {selectedNode.data.conditionType === "expression" && (
                            <label className="flow-field flow-field-compact">
                              <span>表达式</span>
                              <input
                                value={selectedNode.data.expression ?? ""}
                                onChange={(event) => updateSelectedNode({ expression: event.target.value })}
                                placeholder="{{input.priority}} === 'high'"
                              />
                            </label>
                          )}

                          {selectedNode.data.conditionType === "llm_classify" && (
                            <>
                              <label className="flow-field flow-field-compact">
                                <span>模型</span>
                                <input
                                  value={selectedNode.data.llmConfig?.model ?? "gpt-4.1-mini"}
                                  onChange={(event) =>
                                    updateSelectedNode({
                                      llmConfig: { ...selectedNode.data.llmConfig, model: event.target.value } as StudioNodeData["llmConfig"],
                                    })
                                  }
                                  placeholder="gpt-4.1-mini"
                                />
                              </label>
                              <label className="flow-field flow-field-compact">
                                <span>分类提示词</span>
                                <textarea
                                  rows={2}
                                  value={selectedNode.data.llmConfig?.prompt ?? ""}
                                  onChange={(event) =>
                                    updateSelectedNode({
                                      llmConfig: { ...selectedNode.data.llmConfig, prompt: event.target.value } as StudioNodeData["llmConfig"],
                                    })
                                  }
                                  placeholder="判断用户意图属于以下哪类..."
                                />
                              </label>
                            </>
                          )}

                          <div className="config-section-title" style={{ marginTop: "12px" }}>
                            <strong>分支定义</strong>
                          </div>

                          {(selectedNode.data.branches ?? []).map((branch, index) => (
                            <div key={branch.id} className="node-compact-row">
                              <label className="flow-field flow-field-compact">
                                <span>分支 {index + 1} 名称</span>
                                <input
                                  value={branch.label}
                                  onChange={(event) => {
                                    const newBranches = [...(selectedNode.data.branches ?? [])];
                                    newBranches[index] = { ...branch, label: event.target.value };
                                    updateSelectedNode({ branches: newBranches });
                                  }}
                                />
                              </label>
                              {selectedNode.data.conditionType !== "expression" && (
                                <label className="flow-field flow-field-compact">
                                  <span>匹配值</span>
                                  <input
                                    value={branch.conditionValue ?? ""}
                                    onChange={(event) => {
                                      const newBranches = [...(selectedNode.data.branches ?? [])];
                                      newBranches[index] = { ...branch, conditionValue: event.target.value };
                                      updateSelectedNode({ branches: newBranches });
                                    }}
                                    placeholder={selectedNode.data.conditionType === "regex" ? "正则表达式" : "匹配值"}
                                  />
                                </label>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            className="flow-secondary-button"
                            style={{ marginTop: "8px", width: "100%" }}
                            onClick={() => {
                              const newBranch = {
                                id: `branch_${Date.now()}`,
                                label: `分支 ${(selectedNode.data.branches ?? []).length + 1}`,
                                conditionValue: "",
                              };
                              updateSelectedNode({
                                branches: [...(selectedNode.data.branches ?? []), newBranch],
                              });
                            }}
                          >
                            + 添加分支
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <RunConsole
                      title="Run Console"
                      isRunning={isRunStreaming}
                      events={runEvents}
                      result={runResult}
                    />
                  </>
                ) : (
                  selectedFlow ? (
                    <>
                      <div className="config-panel-scroll">
                        <div className="flow-settings-card">
                          <div className="config-section-title">
                            <strong>Flow / Team 整体配置</strong>
                            <span>点击节点可切换到节点参数</span>
                          </div>

                          <label className="flow-field flow-field-compact">
                            <span>名称</span>
                            <input
                              value={selectedFlow.name}
                              onChange={(event) => updateSelectedFlow({ name: event.target.value })}
                            />
                          </label>

                          <label className="flow-field flow-field-compact">
                            <span>类型</span>
                            <select
                              value={selectedFlow.flowType}
                              onChange={(event) => updateSelectedFlow({ flowType: event.target.value as "agent" | "team" })}
                            >
                              <option value="agent">Agent 单 Agent</option>
                              <option value="team">Team 多 Agent</option>
                            </select>
                          </label>

                          <label className="flow-field flow-field-compact">
                            <span>描述</span>
                            <textarea
                              rows={3}
                              value={selectedFlow.description}
                              onChange={(event) => updateSelectedFlow({ description: event.target.value })}
                            />
                          </label>

                          <div className="flow-settings-summary">
                            <span>节点数：{nodes.length}</span>
                            <span>Agent：{nodes.filter((node) => node.data.kind === "agent").length}</span>
                            <span>Team：{nodes.filter((node) => node.data.kind === "team").length}</span>
                          </div>
                        </div>
                      </div>
                      <RunConsole
                        title="Run Console"
                        isRunning={isRunStreaming}
                        events={runEvents}
                        result={runResult}
                      />
                    </>
                  ) : (
                    <span>先创建或打开一个 Flow。</span>
                  )
                )}
              </div>
            </aside>
          </div>

          {isCreateModalOpen ? (
            <div className="flow-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
              <form
                className="flow-modal"
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                  event.preventDefault();
                  void createFlow();
                }}
              >
                <div className="flow-modal-header">
                  <strong>新建 Flow</strong>
                  <button type="button" className="agent-link-button" onClick={() => setIsCreateModalOpen(false)}>
                    关闭
                  </button>
                </div>
                <label className="flow-field">
                  <span>Flow 名称</span>
                  <input value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} placeholder="例如：Customer Support Flow" />
                </label>
                <label className="flow-field">
                  <span>类型</span>
                  <select value={newFlowType} onChange={(event) => setNewFlowType(event.target.value as "agent" | "team")}>
                    <option value="agent">Agent 单 Agent</option>
                    <option value="team">Team 多 Agent</option>
                  </select>
                </label>
                <label className="flow-field">
                  <span>描述</span>
                  <textarea
                    value={newFlowDescription}
                    onChange={(event) => setNewFlowDescription(event.target.value)}
                    placeholder="描述这个 Flow 主要负责什么。"
                    rows={4}
                  />
                </label>
                <div className="flow-modal-actions">
                  <button type="button" className="flow-secondary-button" onClick={() => setIsCreateModalOpen(false)}>
                    取消
                  </button>
                  <button type="submit" className="flow-primary-button" disabled={isCreateDisabled}>
                    创建并进入
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow flow-list-page">
        <header className="flow-page-header">
          <div>
            <h2>Flows</h2>
            <p>{isFlowLoading ? "正在同步本地后端 Flow..." : `${flows.length} 个工作流`}</p>
          </div>

          <div className="flow-header-actions">
            <button type="button" className="flow-primary-button" onClick={() => setIsCreateModalOpen(true)}>
              新建 Flow
            </button>
          </div>
        </header>

        {flowError ? <div className="flow-inline-alert">{flowError}</div> : null}

        <div className="agent-list flow-list-card">
          {flows.length === 0 ? (
            <div className="flow-empty-state">
              <strong>暂无 Flow</strong>
              <p>点击“新建 Flow”创建第一个本地编排。</p>
            </div>
          ) : (
            flows.map((flow) => (
              <article
                key={flow.id}
                className={`agent-row ${selectedFlowId === flow.id ? "is-selected" : ""}`}
                onClick={() => setSelectedFlowId(flow.id)}
              >
                <div className="agent-row-main">
                  <div className={`agent-status agent-status-${flow.status === "published" ? "active" : "draft"}`} />
                  <div>
                    <strong>{flow.name}</strong>
                    <p>{flow.description}</p>
                  </div>
                </div>

                <div className="agent-row-meta">
                  <span>{flow.status}</span>
                  <span>{flow.flowType === "team" ? "Team" : "Agent"}</span>
                  <span>{flow.resources.length ? flow.resources.join(" / ") : "未绑定资源"}</span>
                  <span>{flow.updatedAt}</span>
                </div>

                <div className="agent-row-actions">
                  <button
                    type="button"
                    className="agent-link-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openFlowEditor(flow);
                    }}
                  >
                    打开
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {isCreateModalOpen ? (
          <div className="flow-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
            <form
              className="flow-modal"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                void createFlow();
              }}
            >
              <div className="flow-modal-header">
                <strong>新建 Flow</strong>
                <button type="button" className="agent-link-button" onClick={() => setIsCreateModalOpen(false)}>
                  关闭
                </button>
              </div>
              <label className="flow-field">
                <span>Flow 名称</span>
                <input value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} placeholder="例如：Customer Support Flow" />
              </label>
              <label className="flow-field">
                <span>描述</span>
                <textarea
                  value={newFlowDescription}
                  onChange={(event) => setNewFlowDescription(event.target.value)}
                  placeholder="描述这个 Flow 主要负责什么。"
                  rows={4}
                />
              </label>
              <div className="flow-modal-actions">
                <button type="button" className="flow-secondary-button" onClick={() => setIsCreateModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className="flow-primary-button" disabled={isCreateDisabled}>
                  创建并进入
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AgentsWorkspace() {
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextAgents = await listBackendAgents();
      setAgents(nextAgents);
    } catch (agentError) {
      setAgents([]);
      setError(agentError instanceof Error ? agentError.message : "读取 Agent 列表失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow agent-hub-page">
        <div className="flow-page-header">
          <div>
            <h2>Agent Hub</h2>
            <p>先创建和维护单个 Agent，再在 Flow / Team 里选择它们完成编排。</p>
          </div>
          <div className="flow-header-actions">
            <button type="button" className="flow-secondary-button" onClick={loadAgents} disabled={isLoading}>
              {isLoading ? "刷新中" : "刷新"}
            </button>
            <button type="button" className="flow-primary-button" disabled title="下一步接创建 Agent 表单">
              新建 Agent
            </button>
          </div>
        </div>

        {error ? <div className="flow-error">{error}</div> : null}

        <div className="agent-hub-summary">
          <span>{agents.length} 个 Agent</span>
          <span>{agents.filter((agent) => agent.stream).length} 个流式输出</span>
          <span>{agents.filter((agent) => agent.status === "active").length} 个启用中</span>
        </div>

        <div className="flow-list-card agent-hub-list">
          {isLoading ? (
            <div className="empty-flow-card">
              <strong>正在加载 Agent</strong>
              <p>从后端读取你已经创建好的单 Agent。</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="empty-flow-card">
              <strong>暂无 Agent</strong>
              <p>真实流程里应该先在这里创建荷官、玩家、裁判等 Agent，再去 Flow 编排。</p>
            </div>
          ) : (
            agents.map((agent) => (
              <article key={agent.id} className="agent-row agent-hub-row">
                <div className="agent-row-main">
                  <span className={`agent-status ${agent.status === "active" ? "agent-status-active" : "agent-status-draft"}`} />
                  <div>
                    <strong>{agent.name}</strong>
                    <p>{agent.description || agent.role || "暂无描述"}</p>
                  </div>
                </div>
                <div className="agent-row-meta">
                  <span>{agent.stream ? "stream" : "normal"}</span>
                  <span>{agent.status}</span>
                  <span>{agent.owner_user_id || "local"}</span>
                </div>
                <div className="agent-row-actions">
                  <span className="agent-row-id">{agent.id}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function AppWindowContent({ app }: { app: DesktopApp }) {
  if (app.id === "home") {
    return <HomeFlowConsole />;
  }

  if (app.id === "flow") {
    return <FlowStudioContent />;
  }

  if (app.id === "agents") {
    return <AgentsWorkspace />;
  }

  const sections =
    app.id === "skills"
        ? skillSections
        : app.id === "knowledge"
          ? knowledgeSections
          : mcpSections;

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-app">
        <div className="content-heading">
          <h2>{app.label}</h2>
          <p>{app.summary}</p>
        </div>
        <dl className="content-meta">
          {sections.map((section) => (
            <div key={section.title} className="content-meta-row">
              <dt>{section.title}</dt>
              <dd>{section.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [activeAppId, setActiveAppId] = useState<AppId>(() => {
    const routeApp = readQueryParam("app");
    return isAppId(routeApp) ? routeApp : "home";
  });
  const [windowMode, setWindowMode] = useState<WindowMode>(() => {
    const routeApp = readQueryParam("app");
    const routeMode = readQueryParam("mode");

    if (routeMode === "minimized") {
      return "minimized";
    }

    return isAppId(routeApp) && routeApp !== "home" ? "maximized" : "normal";
  });
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isWindowClosed, setIsWindowClosed] = useState(false);
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  const activeApp = useMemo(
    () => apps.find((app) => app.id === activeAppId) ?? apps[0],
    [activeAppId],
  );

  useEffect(() => {
    replaceRouteQuery({
      app: activeAppId === "home" ? null : activeAppId,
      mode: windowMode === "maximized" ? null : windowMode,
      view: activeAppId === "flow" ? readQueryParam("view") : null,
      flow: activeAppId === "flow" ? readQueryParam("flow") : null,
    });
  }, [activeAppId, windowMode]);

  useEffect(() => {
    const restoreFromUrl = () => {
      const routeApp = readQueryParam("app");
      const nextAppId = isAppId(routeApp) ? routeApp : "home";
      const routeMode = readQueryParam("mode");

      setActiveAppId(nextAppId);
      setWindowMode(
        routeMode === "minimized" || routeMode === "normal"
          ? routeMode
          : nextAppId === "home"
            ? "normal"
            : "maximized",
      );
      setIsWindowClosed(false);
    };

    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  const openApp = (id: AppId) => {
    setActiveAppId(id);
    setIsWindowClosed(false);
    setWindowMode((mode) => (id === "home" || mode === "minimized" ? "normal" : mode));
  };

  const startWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (windowMode === "maximized" || event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(".window-actions")) {
      return;
    }

    const windowElement = event.currentTarget.closest(".app-window");
    if (!(windowElement instanceof HTMLElement)) {
      return;
    }

    const rect = windowElement.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = rect.left;
    const originY = rect.top;

    setWindowPosition({ x: originX, y: originY });
    setIsWindowDragging(true);

    const moveWindow = (moveEvent: PointerEvent) => {
      const nextX = originX + moveEvent.clientX - startX;
      const nextY = originY + moveEvent.clientY - startY;
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(52, window.innerHeight - rect.height - 12);

      setWindowPosition({
        x: Math.min(Math.max(12, nextX), maxX),
        y: Math.min(Math.max(52, nextY), maxY),
      });
    };

    const stopWindowDrag = () => {
      setIsWindowDragging(false);
      window.removeEventListener("pointermove", moveWindow);
      window.removeEventListener("pointerup", stopWindowDrag);
      window.removeEventListener("pointercancel", stopWindowDrag);
    };

    window.addEventListener("pointermove", moveWindow);
    window.addEventListener("pointerup", stopWindowDrag);
    window.addEventListener("pointercancel", stopWindowDrag);
  };

  const closeWindow = () => {
    setWindowMode("normal");
    setActiveAppId("home");
    setIsWindowClosed(true);
    replaceRouteQuery({ app: null, mode: null, view: null, flow: null });
  };

  const showWindow = !isWindowClosed && windowMode !== "minimized";
  const isFullscreen = windowMode === "maximized";

  useEffect(() => {
    if (activeAppId !== "flow" || windowMode !== "normal" || !showWindow) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("agent-studio:center-flow"));
    }, 160);

    return () => window.clearTimeout(timer);
  }, [activeAppId, showWindow, windowMode]);

  return (
    <main className={`desktop-scene ${isFullscreen ? "is-window-maximized" : ""}`}>
      <div className="desktop-noise" />
      <div className="desktop-grid" />

      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">A</div>
          <div className="crumb">Agent Studio</div>
          <span className="crumb-sep">/</span>
          <div className="workspace-chip">
            <span className="workspace-dot" />
            <span>Builder Workspace</span>
          </div>
        </div>

        <nav className="topbar-right">
          <span className="status-chip">
            <span className="status-light" />
            v1.0
          </span>
          <button type="button" onClick={() => openApp("flow")}>
            Flows
          </button>
          <button type="button" onClick={() => openApp("agents")}>
            Agents
          </button>
          <button type="button" onClick={() => openApp("home")}>
            Runs
          </button>
          <div className="avatar">WS</div>
        </nav>
      </header>

      <section className="desktop-stage">
        <div className="desktop-stage-header">
          <div>
            <span className="stage-kicker">Workspace</span>
            <h2>Agent Studio 桌面工作台</h2>
            <p>从首页进入 Flow、Agent、Skills、Knowledge 与 MCP，逐步搭起你的多 Agent 平台。</p>
          </div>
          <div className="desktop-tip">点击下方或中间入口，打开对应工作区。</div>
        </div>

        <section className="desktop-icons">
          {apps.slice(1).map((app) => (
            <button key={app.id} type="button" className="desktop-icon" onClick={() => openApp(app.id)}>
              <div className="desktop-icon-tile" style={{ background: app.color }}>
                <AppGlyph icon={app.icon} />
              </div>
              <span>{app.label}</span>
            </button>
          ))}
        </section>
      </section>

      {showWindow ? (
        <section
          className={`app-window ${windowMode === "maximized" ? "is-maximized" : ""} ${
            isWindowDragging ? "is-dragging" : ""
          }`}
          style={
            windowMode === "normal" && windowPosition
              ? { left: windowPosition.x, top: windowPosition.y, transform: "none" }
              : undefined
          }
        >
          <div className="window-titlebar" onPointerDown={startWindowDrag}>
            <div className="window-app">
              <div className="window-app-icon" style={{ background: activeApp.color }}>
                <AppGlyph icon={activeApp.icon} />
              </div>
              <div>
                <strong>{activeApp.label}</strong>
                <span>{activeApp.summary}</span>
              </div>
            </div>

            <div className="window-actions">
              <button type="button" aria-label="Minimize" onClick={() => setWindowMode("minimized")}>
                -
              </button>
              <button
                type="button"
                aria-label="Fullscreen"
                onClick={() => setWindowMode((mode) => (mode === "maximized" ? "normal" : "maximized"))}
              >
                □
              </button>
              <button type="button" aria-label="Close" onClick={closeWindow}>
                ×
              </button>
            </div>
          </div>

          <div className="window-body">
            <AppWindowContent app={activeApp} />
          </div>
        </section>
      ) : activeAppId !== "home" ? (
        <button type="button" className="window-restore" onClick={() => setIsWindowClosed(false)}>
          重新打开 {activeApp.label}
        </button>
      ) : null}

      <div className={`dock-wrap ${isDockCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="dock-toggle"
          onClick={() => setIsDockCollapsed((value) => !value)}
          aria-label={isDockCollapsed ? "Show dock" : "Hide dock"}
        >
          {isDockCollapsed ? "▲" : "▼"}
        </button>

        <div className="dock">
          {apps.map((app) => {
            const isActive = activeAppId === app.id && showWindow;

            return (
              <button
                key={app.id}
                type="button"
                className={`dock-item ${isActive ? "is-active" : ""}`}
                onClick={() => openApp(app.id)}
                aria-label={app.label}
              >
                <div className="dock-item-icon" style={{ background: app.color }}>
                  <AppGlyph icon={app.icon} />
                </div>
                <span className="dock-tooltip">{app.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
