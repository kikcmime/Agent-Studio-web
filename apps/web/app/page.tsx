"use client";

import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AgentsWorkspace } from "../features/agents/components/agents-workspace";
import { TeamPreviewModal } from "../features/flow/components/flow-canvas";
import {
  FlowStudioContent,
  createEdgesFromDefinition,
  createNodesFromDefinition,
} from "../features/flow/components/flow-studio-content";
import {
  getBackendFlow,
  listBackendFlows,
  type BackendFlow,
  type BackendFlowSummary,
} from "../features/flow/model/flow-api";
import { HomeFlowConsole } from "../features/home/components/home-flow-console";
import { type AppId, isAppId, readQueryParam, replaceRouteQuery } from "../features/workspace/lib/router-state";

type WindowMode = "normal" | "maximized" | "minimized";

type DesktopApp = {
  id: AppId;
  label: string;
  short: string;
  color: string;
  icon: string;
  summary: string;
  hidden?: boolean;
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
    id: "studio",
    label: "Studio",
    short: "Studio",
    color: "linear-gradient(135deg, #c7d2fe, #6ee7b7)",
    icon: "ring",
    summary: "只查看对外暴露数字人的结构、运行与入口状态。",
  },
  {
    id: "flow",
    label: "编排",
    short: "Flow",
    color: "linear-gradient(135deg, #c7d2fe, #6ee7b7)",
    icon: "ring",
    summary: "编辑当前 Agent / Team 的节点、路径和回溯逻辑。",
    hidden: true,
  },
  {
    id: "agents",
    label: "我的数字人",
    short: "Agents",
    color: "linear-gradient(135deg, #8fdcc2, #9ea7ff)",
    icon: "code",
    summary: "统一管理可执行的 Agent 与 Team。",
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

function StudioWorkspace({
  onRunFlow,
  onBackToAssets,
}: {
  onRunFlow: (flowId: string) => void;
  onBackToAssets: () => void;
}) {
  const [flows, setFlows] = useState<BackendFlowSummary[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [previewFlow, setPreviewFlow] = useState<BackendFlow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStudioFlows() {
      setIsLoading(true);
      setError("");

      try {
        const exposedFlows = (await listBackendFlows()).filter((flow) => flow.is_exposed);
        const primaryFlow = exposedFlows.find((flow) => flow.is_primary);

        if (!mounted) {
          return;
        }

        setFlows(exposedFlows);
        setSelectedFlowId(primaryFlow?.id || exposedFlows[0]?.id || "");
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "读取 Studio 数字人失败");
          setFlows([]);
          setSelectedFlowId("");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStudioFlows();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0] ?? null;

  const openFlowPreview = useCallback(async (flowId: string) => {
    try {
      const detail = await getBackendFlow(flowId);
      setPreviewFlow(detail);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "读取结构失败");
    }
  }, []);

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow flow-list-page">
        <header className="flow-page-header">
          <div>
            <h2>Studio 工作台</h2>
            <p>这里只展示已经对外暴露的最终数字人，用于运行、预览结构和确认主入口状态。</p>
          </div>
          <div className="flow-header-actions">
            <button type="button" className="flow-secondary-button" onClick={onBackToAssets}>
              去我的数字人
            </button>
            {selectedFlow ? (
              <button type="button" className="flow-primary-button" onClick={() => onRunFlow(selectedFlow.id)}>
                运行当前数字人
              </button>
            ) : null}
          </div>
        </header>

        {error ? <div className="flow-inline-alert">{error}</div> : null}

        <div className="agent-hub-layout studio-hub-layout">
          <aside className="agent-sidebar">
            <div className="agent-sidebar-title">
              <strong>已暴露数字人</strong>
            </div>
            {isLoading ? (
              <div className="empty-flow-card">
                <strong>正在加载</strong>
                <p>读取对外数字人列表。</p>
              </div>
            ) : flows.length === 0 ? (
              <div className="empty-flow-card">
                <strong>暂无已暴露数字人</strong>
                <p>先到“我的数字人”里创建并暴露一个 Agent 或 Team。</p>
              </div>
            ) : (
              flows.map((flow) => (
                <button
                  key={flow.id}
                  type="button"
                  className={`agent-card ${flow.id === selectedFlowId ? "is-active" : ""}`}
                  onClick={() => setSelectedFlowId(flow.id)}
                >
                  <strong>{flow.name}</strong>
                  <span>{flow.description || "对外数字人入口"}</span>
                  <em>{flow.is_primary ? "主入口" : flow.flow_type === "team" ? "Team" : "Agent"}</em>
                </button>
              ))
            )}
          </aside>

          <div className="agent-detail-panel">
            {selectedFlow ? (
              <article className="asset-detail-card">
                <div className="asset-detail-header">
                  <div>
                    <strong>{selectedFlow.name}</strong>
                    <span>{selectedFlow.description || "这里展示对外数字人的最终形态和入口属性。"}</span>
                  </div>
                  <div className="asset-detail-badges">
                    <span>{selectedFlow.flow_type === "team" ? "Team" : "Agent"}</span>
                    {selectedFlow.is_primary ? <span>Primary</span> : null}
                    <span>{selectedFlow.status}</span>
                  </div>
                </div>

                <div className="asset-detail-meta">
                  <div>
                    <label>Flow ID</label>
                    <span>{selectedFlow.id}</span>
                  </div>
                  <div>
                    <label>Version</label>
                    <span>v{selectedFlow.latest_version}</span>
                  </div>
                  <div>
                    <label>暴露状态</label>
                    <span>{selectedFlow.is_exposed ? "已暴露" : "未暴露"}</span>
                  </div>
                </div>

                <div className="asset-detail-actions">
                  <button type="button" className="flow-primary-button" onClick={() => onRunFlow(selectedFlow.id)}>
                    立即运行
                  </button>
                  <button type="button" className="agent-link-button" onClick={() => openFlowPreview(selectedFlow.id)}>
                    查看结构
                  </button>
                  <button type="button" className="agent-link-button" onClick={onBackToAssets}>
                    去我的数字人编辑
                  </button>
                </div>
              </article>
            ) : (
              <article className="empty-flow-card">
                <strong>未选择数字人</strong>
                <p>从左侧选择一个暴露中的数字人以查看结构和运行入口。</p>
              </article>
            )}
          </div>
        </div>

        <TeamPreviewModal
          definition={previewFlow?.definition ?? null}
          title={previewFlow ? `${previewFlow.name} · 数字人结构` : "数字人结构"}
          description={previewFlow?.description || "这里只做结构预览，不在 Studio 工作台里直接编辑。"}
          onClose={() => setPreviewFlow(null)}
          createNodesFromDefinition={createNodesFromDefinition}
          createEdgesFromDefinition={createEdgesFromDefinition}
        />
      </div>
    </section>
  );
}

function AppWindowContent({
  app,
  onOpenStudio,
  onRunFlow,
  onBackToAssets,
}: {
  app: DesktopApp;
  onOpenStudio: (flowId: string) => void;
  onRunFlow: (flowId: string) => void;
  onBackToAssets: () => void;
}) {
  if (app.id === "home") return <HomeFlowConsole />;
  if (app.id === "studio") return <StudioWorkspace onRunFlow={onRunFlow} onBackToAssets={onBackToAssets} />;
  if (app.id === "flow") return <FlowStudioContent onBackToAssets={onBackToAssets} />;
  if (app.id === "agents") return <AgentsWorkspace onOpenStudio={onOpenStudio} onRunFlow={onRunFlow} />;

  const sections = app.id === "skills" ? skillSections : app.id === "knowledge" ? knowledgeSections : mcpSections;

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

  const activeApp = useMemo(() => apps.find((app) => app.id === activeAppId) ?? apps[0], [activeAppId]);

  useEffect(() => {
    replaceRouteQuery({
      app: activeAppId === "home" ? null : activeAppId,
      mode: windowMode === "maximized" ? null : windowMode,
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
    replaceRouteQuery({
      app: id === "home" ? null : id,
      mode: id === "home" ? null : readQueryParam("mode"),
    });
    setActiveAppId(id);
    setIsWindowClosed(false);
    setWindowMode((mode) => (id === "home" || mode === "minimized" ? "normal" : mode));
  };

  const openStudioFlow = (flowId: string) => {
    replaceRouteQuery({ app: "flow", flow: flowId, mode: null });
    setActiveAppId("flow");
    setIsWindowClosed(false);
    setWindowMode("maximized");
  };

  const runFlowAsset = (flowId: string) => {
    replaceRouteQuery({
      app: null,
      mode: null,
      flow: flowId,
      agent: null,
    });
    setActiveAppId("home");
    setIsWindowClosed(false);
    setWindowMode("normal");
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
    replaceRouteQuery({ app: null, mode: null, flow: null });
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
          <div className="brand-mark">
            <img src="/icon.svg" alt="Agent Studio" className="brand-mark-icon" />
          </div>
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
          <button type="button" onClick={() => openApp("agents")}>
            我的数字人
          </button>
          <button type="button" onClick={() => openApp("studio")}>
            Studio
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
            <p>Studio 负责查看对外数字人；内部 Agent / Team 的创建、配置和编排，继续从“我的数字人”进入。</p>
          </div>
          <div className="desktop-tip">点击下方或中间入口，打开对应工作区。</div>
        </div>

        <section className="desktop-icons">
          {apps
            .filter((app) => !app.hidden && app.id !== "home")
            .map((app) => (
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
              ? {
                  left: windowPosition.x,
                  top: windowPosition.y,
                  transform: "none",
                }
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
            <AppWindowContent
              app={activeApp}
              onOpenStudio={openStudioFlow}
              onRunFlow={runFlowAsset}
              onBackToAssets={() => {
                replaceRouteQuery({ app: "agents", mode: null, flow: null });
                setActiveAppId("agents");
                setIsWindowClosed(false);
                setWindowMode("maximized");
              }}
            />
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
          {apps
            .filter((app) => !app.hidden)
            .map((app) => {
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
