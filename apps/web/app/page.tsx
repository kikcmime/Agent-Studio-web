"use client";

import "@xyflow/react/dist/style.css";

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import {
  flowStudioNodeConfigs,
  getFlowStudioNodeConfig,
  type FlowStudioNodeKind,
} from "../features/flow/model/node-config";

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

const homeHighlights = [
  "Flow 编排",
  "Agent 配置",
  "Skill 绑定",
  "知识库接入",
  "MCP 能力接入",
  "Run 运行观测",
];

type FlowRecord = {
  id: string;
  name: string;
  status: "draft" | "published";
  updatedAt: string;
  agents: string[];
  description: string;
};

const flowRecords: FlowRecord[] = [
  {
    id: "flow_support_triage",
    name: "Support Triage",
    status: "draft",
    updatedAt: "2h ago",
    agents: ["Triage Agent", "Billing Agent"],
    description: "接收用户问题，分类后路由到客服或账单处理节点。",
  },
  {
    id: "flow_rag_assistant",
    name: "RAG Assistant",
    status: "published",
    updatedAt: "Today",
    agents: ["Research Agent"],
    description: "基于知识库检索生成回答，并保留运行日志。",
  },
  {
    id: "flow_lead_routing",
    name: "Lead Routing",
    status: "draft",
    updatedAt: "Yesterday",
    agents: ["Triage Agent", "Research Agent"],
    description: "判断线索来源和意图，将请求分发到对应 Agent。",
  },
];

const availableAgents = [
  "Triage Agent",
  "Billing Agent",
  "Research Agent",
  "Knowledge Agent",
];

type StudioNodeData = {
  kind: FlowStudioNodeKind;
  label: string;
  agentName?: string;
};

const createInitialNodes = (flow: FlowRecord): Node<StudioNodeData>[] => [
  {
    id: `${flow.id}_start`,
    type: "input",
    position: { x: 80, y: 220 },
    data: { kind: "start", label: "Start" },
    style: {
      background: getFlowStudioNodeConfig("start").color,
      borderRadius: 14,
      border: "1px solid rgba(54, 65, 83, 0.12)",
    },
  },
  {
    id: `${flow.id}_agent_1`,
    position: { x: 300, y: 220 },
    data: {
      kind: "agent",
      label: flow.agents[0] ?? "Agent Node",
      agentName: flow.agents[0] ?? availableAgents[0],
    },
    style: {
      background: getFlowStudioNodeConfig("agent").color,
      borderRadius: 14,
      border: "1px solid rgba(54, 65, 83, 0.12)",
    },
  },
  {
    id: `${flow.id}_condition`,
    position: { x: 560, y: 220 },
    data: { kind: "condition", label: "Condition" },
    style: {
      background: getFlowStudioNodeConfig("condition").color,
      borderRadius: 14,
      border: "1px solid rgba(54, 65, 83, 0.12)",
    },
  },
  {
    id: `${flow.id}_agent_2`,
    position: { x: 820, y: 220 },
    data: {
      kind: "agent",
      label: flow.agents[1] ?? "Agent Node",
      agentName: flow.agents[1] ?? availableAgents[1],
    },
    style: {
      background: getFlowStudioNodeConfig("agent").color,
      borderRadius: 14,
      border: "1px solid rgba(54, 65, 83, 0.12)",
    },
  },
  {
    id: `${flow.id}_end`,
    type: "output",
    position: { x: 1080, y: 220 },
    data: { kind: "end", label: "End" },
    style: {
      background: getFlowStudioNodeConfig("end").color,
      borderRadius: 14,
      border: "1px solid rgba(54, 65, 83, 0.12)",
    },
  },
];

const createInitialEdges = (flow: FlowRecord): Edge[] => [
  { id: `${flow.id}_e1`, source: `${flow.id}_start`, target: `${flow.id}_agent_1` },
  { id: `${flow.id}_e2`, source: `${flow.id}_agent_1`, target: `${flow.id}_condition` },
  { id: `${flow.id}_e3`, source: `${flow.id}_condition`, target: `${flow.id}_agent_2` },
  { id: `${flow.id}_e4`, source: `${flow.id}_agent_2`, target: `${flow.id}_end` },
];

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

function FlowCanvas(props: {
  nodes: Node<StudioNodeData>[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState<StudioNodeData>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  onConnect: (connection: Connection) => void;
  onNodeClick: (_: React.MouseEvent, node: Node<StudioNodeData>) => void;
  onPaneClick: () => void;
  focusNodeId?: string | null;
}) {
  const { fitView } = useReactFlow();

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

  return (
    <ReactFlow
      nodes={props.nodes}
      edges={props.edges}
      onNodesChange={props.onNodesChange}
      onEdgesChange={props.onEdgesChange}
      onConnect={props.onConnect}
      fitView
      onNodeClick={props.onNodeClick}
      onPaneClick={props.onPaneClick}
    >
      <Background gap={20} size={1} />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}

function FlowStudioContent() {
  const [flows, setFlows] = useState<FlowRecord[]>(flowRecords);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(flowRecords[0]?.id ?? "");
  const [flowView, setFlowView] = useState<"list" | "editor">("list");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [canvasNotice, setCanvasNotice] = useState<string>("");

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0];
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNodeData>(selectedFlow ? createInitialNodes(selectedFlow) : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(selectedFlow ? createInitialEdges(selectedFlow) : []);

  useEffect(() => {
    if (!selectedFlow) {
      return;
    }

    setNodes(createInitialNodes(selectedFlow));
    setEdges(createInitialEdges(selectedFlow));
    setSelectedNodeId(`${selectedFlow.id}_agent_1`);
    setFocusNodeId(`${selectedFlow.id}_agent_1`);
  }, [selectedFlow?.id, setEdges, setNodes]);

  useEffect(() => {
    if (!canvasNotice) {
      return;
    }

    const timer = window.setTimeout(() => setCanvasNotice(""), 1600);
    return () => window.clearTimeout(timer);
  }, [canvasNotice]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  const onConnect = (connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, animated: false }, current));
  };

  const addNode = (kind: FlowStudioNodeKind) => {
    const id = `${selectedFlow.id}_${kind}_${Date.now()}`;
    const config = getFlowStudioNodeConfig(kind);
    let createdNode: Node<StudioNodeData> | null = null;

    setNodes((current) => {
      createdNode = {
        id,
        type: kind === "start" ? "input" : kind === "end" ? "output" : undefined,
        position: {
          x: 160 + (current.length % 4) * 210,
          y: 120 + Math.floor(current.length / 4) * 120,
        },
        data: {
          kind,
          label: kind === "agent" ? "Agent Node" : config.label,
          agentName: kind === "agent" ? availableAgents[0] : undefined,
        },
        style: {
          background: config.color,
          borderRadius: 14,
          border: "1px solid rgba(54, 65, 83, 0.12)",
        },
      };

      return [...current, createdNode];
    });
    setSelectedNodeId(id);
    setFocusNodeId(id);
    setCanvasNotice(`${config.label} 节点已添加`);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setCanvasNotice("已删除选中节点");
    setSelectedNodeId(null);
    setFocusNodeId(null);
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

  const createFlow = () => {
    const normalizedName = newFlowName.trim();

    if (!normalizedName) {
      return;
    }

    const createdFlow: FlowRecord = {
      id: `flow_${Date.now()}`,
      name: normalizedName,
      status: "draft",
      updatedAt: "Just now",
      agents: [],
      description: newFlowDescription.trim() || "新的多 Agent 工作流，等待进入画布继续配置。",
    };

    setFlows((current) => [createdFlow, ...current]);
    setSelectedFlowId(createdFlow.id);
    setFlowView("editor");
    setIsCreateModalOpen(false);
    setNewFlowName("");
    setNewFlowDescription("");
  };

  const isCreateDisabled = !newFlowName.trim();

  if (flowView === "editor" && selectedFlow) {
    return (
      <section className="workspace-canvas workspace-canvas-plain">
        <div className="content-doc content-doc-flow">
          <header className="flow-page-header">
            <div>
              <span className="hero-pill">Flow Studio</span>
              <h2>{selectedFlow.name}</h2>
              <p>{selectedFlow.description}</p>
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
              <button type="button" className="flow-primary-button">
                运行调试
              </button>
            </div>
          </header>

          <div className="flow-editor-shell">
            <aside className="flow-editor-panel">
              <strong>节点库</strong>
              {flowStudioNodeConfigs.map((nodeType) => (
                <button
                  key={nodeType.kind}
                  type="button"
                  className="flow-node-chip"
                  onClick={() => addNode(nodeType.kind)}
                >
                  <strong>{nodeType.label}</strong>
                  <span>{nodeType.description}</span>
                </button>
              ))}
            </aside>

            <section className="flow-editor-canvas">
              {canvasNotice ? <div className="flow-canvas-notice">{canvasNotice}</div> : null}
              <ReactFlowProvider>
                <FlowCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  onPaneClick={() => setSelectedNodeId(null)}
                  focusNodeId={focusNodeId}
                />
              </ReactFlowProvider>
            </section>

            <aside className="flow-editor-panel">
              <strong>节点配置</strong>
              {selectedNode ? (
                <>
                  <label className="flow-field flow-field-compact">
                    <span>节点标题</span>
                    <input
                      value={selectedNode.data.label}
                      onChange={(event) => updateSelectedNode({ label: event.target.value })}
                    />
                  </label>
                  {selectedNode.data.kind === "agent" ? (
                    <label className="flow-field flow-field-compact">
                      <span>绑定 Agent</span>
                      <select
                        value={selectedNode.data.agentName ?? availableAgents[0]}
                        onChange={(event) =>
                          updateSelectedNode({
                            agentName: event.target.value,
                            label: event.target.value,
                          })
                        }
                      >
                        {availableAgents.map((agent) => (
                          <option key={agent} value={agent}>
                            {agent}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <span>类型：{selectedNode.data.kind}</span>
                  <span>节点 ID：{selectedNode.id}</span>
                  <span>资源：Skills / KB / MCP</span>
                </>
              ) : (
                <span>先点击画布中的节点，再在这里编辑配置。</span>
              )}
            </aside>
          </div>

          {isCreateModalOpen ? (
            <div className="flow-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
              <form
                className="flow-modal"
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                  event.preventDefault();
                  createFlow();
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

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow">
        <header className="flow-page-header">
          <div>
            <span className="hero-pill">Flow Studio</span>
            <h2>Flows</h2>
            <p>先看工作流列表，再进入某个 Flow 做可视化编排。</p>
          </div>

            <div className="flow-header-actions">
              <button type="button" className="flow-secondary-button">
                导入 Flow
              </button>
              <button type="button" className="flow-primary-button" onClick={() => setIsCreateModalOpen(true)}>
                新建 Flow
              </button>
            </div>
          </header>

          <div className="flow-toolbar">
            <div className="flow-toolbar-meta">
              <span className="flow-toolbar-title">Flow 列表</span>
              <span className="flow-toolbar-subtitle">{flows.length} flows</span>
            </div>
            <div className="flow-toolbar-actions">
              <button type="button" className="flow-filter-button">
                全部状态
            </button>
            <button type="button" className="flow-filter-button">
              最近更新
            </button>
          </div>
        </div>

        <div className="agent-list">
          {flows.map((flow) => (
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
                <span>{flow.agents.join(" / ")}</span>
                <span>{flow.updatedAt}</span>
              </div>

              <div className="agent-row-actions">
                <button type="button" className="agent-link-button">
                  编辑
                </button>
                <button
                  type="button"
                  className="agent-link-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedFlowId(flow.id);
                    setFlowView("editor");
                  }}
                >
                  打开
                </button>
              </div>
            </article>
          ))}
        </div>

        <section className="flow-studio-summary">
          <div>
            <strong>当前 Flow</strong>
            <p>{selectedFlow?.name}</p>
          </div>
          <div>
            <strong>绑定 Agents</strong>
            <p>{selectedFlow?.agents.join(" / ")}</p>
          </div>
          <div>
            <strong>可用 Agent</strong>
            <p>{availableAgents.join(" / ")}</p>
          </div>
        </section>

        {isCreateModalOpen ? (
          <div className="flow-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
            <form
              className="flow-modal"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                createFlow();
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

function AppWindowContent({ app }: { app: DesktopApp }) {
  if (app.id === "home") {
    return (
      <div className="content-doc content-doc-home">
        <span className="hero-pill">Agent Studio v1.0</span>
        <h1>多 Agent 编排工作台</h1>
        <p>围绕 Flow、Agent、Skill、知识库和 MCP 组织你的工作入口。</p>
        <ul className="content-list content-list-inline">
          {homeHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (app.id === "flow") {
    return <FlowStudioContent />;
  }

  const sections =
    app.id === "agents"
      ? agentSections
      : app.id === "skills"
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
  const [activeAppId, setActiveAppId] = useState<AppId>("home");
  const [windowMode, setWindowMode] = useState<WindowMode>("normal");
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isWindowClosed, setIsWindowClosed] = useState(false);

  const activeApp = useMemo(
    () => apps.find((app) => app.id === activeAppId) ?? apps[0],
    [activeAppId],
  );

  const openApp = (id: AppId) => {
    setActiveAppId(id);
    setIsWindowClosed(false);
    setWindowMode(id === "home" ? "normal" : "maximized");
  };

  const closeWindow = () => {
    setWindowMode("normal");
    setActiveAppId("home");
    setIsWindowClosed(true);
  };

  const showWindow = !isWindowClosed && windowMode !== "minimized";
  const isFullscreen = windowMode === "maximized";

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
          <button type="button">Flows</button>
          <button type="button">Agents</button>
          <button type="button">Runs</button>
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
        <section className={`app-window ${windowMode === "maximized" ? "is-maximized" : ""}`}>
          <div className="window-titlebar">
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
