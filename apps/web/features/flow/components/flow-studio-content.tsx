"use client";

import "@xyflow/react/dist/style.css";

import {
  ReactFlowProvider,
  type Edge,
} from "@xyflow/react";
import { createForm } from "@formily/core";
import { useEffect, useMemo, useState } from "react";
import { splitIds } from "../../agents/lib/agent-assets";
import {
  readHomeConsoleConfigMap,
  writeHomeConsoleConfigMap,
  type HomeConsoleConfig,
} from "../../workspace/lib/directory-storage";
import { FlowCanvas, FlowNodeSelector, TeamPreviewModal } from "./flow-canvas";
import { FlowSidePanel } from "./flow-side-panel";
import type { StudioNodeData } from "./flow-studio-types";
import { useFlowCatalog } from "./use-flow-catalog";
import { useFlowGraphEditor } from "./use-flow-graph-editor";
import { useFlowRunState } from "./use-flow-run-state";
import { useFlowStudioUiState } from "./use-flow-studio-ui-state";
import { useSelectedAgentEditor } from "./use-selected-agent-editor";
import {
  agentDetailToDraft,
  backendFlowToRecord,
  createEdgesFromDefinition,
  createNodesFromDefinition,
  emptyAgentDraft,
  joinPromptLines,
  nodesToBackendDefinition,
  splitPromptLines,
} from "../model/flow-studio-mappers";

export { createEdgesFromDefinition, createNodesFromDefinition } from "../model/flow-studio-mappers";

export function FlowStudioContent({ onBackToAssets }: { onBackToAssets: () => void }) {
  const [flowError, setFlowError] = useState<string>("");
  const [homeConsoleConfigMap, setHomeConsoleConfigMap] = useState<Record<string, HomeConsoleConfig>>(
    () => readHomeConsoleConfigMap(),
  );
  const agentForm = useMemo(() => createForm({ initialValues: emptyAgentDraft }), []);
  const {
    selectedNodeId,
    setSelectedNodeId,
    isFlowSettingsOpen,
    setIsFlowSettingsOpen,
    focusNodeId,
    setFocusNodeId,
    centerSignal,
    canvasNotice,
    setCanvasNotice,
    nodeSelectorAnchor,
    setNodeSelectorAnchor,
    previewTeamNodeId,
    setPreviewTeamNodeId,
    toggleTeamMembers,
  } = useFlowStudioUiState();

  const {
    flows,
    selectedFlowId,
    setSelectedFlowId,
    selectedFlow,
    backendAgents,
    setBackendAgents,
    backendTeams,
    isFlowLoading,
    isFlowSaving,
    updateSelectedFlow,
    saveCurrentFlow,
  } = useFlowCatalog({
    backendFlowToRecord,
    nodesToBackendDefinition,
    setFlowError,
    setCanvasNotice,
  });
  const agentOptions = backendAgents;
  const teamOptions = backendTeams;
  const { runResult, runEvents, isRunStreaming, resetRunState, runCurrentFlow } = useFlowRunState(
    selectedFlow?.id,
    setFlowError,
    setCanvasNotice,
  );
  const selectedFlowHomeConfig = useMemo(
    () => (selectedFlow ? homeConsoleConfigMap[selectedFlow.id] ?? {} : {}),
    [homeConsoleConfigMap, selectedFlow],
  );
  const updateSelectedFlowHomeConfig = (patch: Partial<HomeConsoleConfig>) => {
    if (!selectedFlow) {
      return;
    }

    setHomeConsoleConfigMap((current) => {
      const next = {
        ...current,
        [selectedFlow.id]: {
          ...current[selectedFlow.id],
          ...patch,
        },
      };
      writeHomeConsoleConfigMap(next);
      return next;
    });
  };

  const {
    nodes,
    setEdges,
    onNodesChange,
    edges,
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
  } = useFlowGraphEditor({
    selectedFlow,
    backendAgents,
    teamOptions,
    selectedNodeId,
    setSelectedNodeId,
    setIsFlowSettingsOpen,
    setFocusNodeId,
    setCanvasNotice,
    setFlowError,
    nodeSelectorAnchor,
    setNodeSelectorAnchor,
    previewTeamNodeId,
    setPreviewTeamNodeId,
    updateSelectedFlow,
    resetRunState,
    createNodesFromDefinition,
    createEdgesFromDefinition,
  });
  const selectedAgentId = selectedNode?.data.kind === "agent" ? selectedNode.data.agentId : undefined;
  const { isAgentSaving, saveSelectedAgent } = useSelectedAgentEditor({
    selectedAgentId,
    agentForm,
    emptyAgentDraft,
    agentDetailToDraft,
    splitIds,
    setFlowError,
    setCanvasNotice,
    setBackendAgents,
    updateSelectedNode,
  });
  if (!selectedFlow) {
    return (
      <section className="workspace-canvas workspace-canvas-plain">
        <div className="content-doc content-doc-flow flow-list-page">
          <header className="flow-page-header">
            <div>
              <h2>Studio</h2>
              <p>Studio 只负责编辑当前 Agent / Team，请从“我的数字人”选择一个资产进入编排。</p>
            </div>
            <div className="flow-header-actions">
              <button type="button" className="flow-primary-button" onClick={onBackToAssets}>
                返回我的数字人
              </button>
            </div>
          </header>
          {flowError ? <div className="flow-inline-alert">{flowError}</div> : null}
          <div className="flow-empty-state">
            <strong>暂未打开数字人</strong>
            <p>你可以在“我的数字人”里选择任意 Agent 或 Team，然后进入 Studio 进行可视化编排。</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow content-doc-flow-editor">
        <header className="flow-page-header">
          <div>
            <h2>{selectedFlow.name}</h2>
            <p>
              {selectedFlow.flowType === "team" ? "Team 可编排工作区" : "Agent 可视化工作区"}
              {selectedFlow.isExposed ? " · 已暴露" : " · 内部编排"}
              {selectedFlow.isPrimary ? " · 主入口" : ""}
            </p>
          </div>

          <div className="flow-header-actions">
            <button type="button" className="flow-secondary-button" onClick={onBackToAssets}>
              返回我的数字人
            </button>
            <button type="button" className="flow-secondary-button" onClick={deleteSelectedNode}>
              删除节点
            </button>
            <button
              type="button"
              className="flow-secondary-button"
              onClick={() => void saveCurrentFlow(nodes, edges)}
              disabled={isFlowSaving}
            >
              {isFlowSaving ? "保存中..." : "保存编排"}
            </button>
            <button type="button" className="flow-primary-button" onClick={runCurrentFlow}>
              {isRunStreaming ? "运行中..." : "运行调试"}
            </button>
          </div>
        </header>

        {flowError ? <div className="flow-inline-alert">{flowError}</div> : null}
        {isFlowLoading ? <div className="flow-inline-alert">正在加载编排...</div> : null}

        <div className={`flow-editor-shell ${selectedNodeId || isFlowSettingsOpen ? "has-panel-open" : ""}`}>
          <section className="flow-editor-canvas">
            {canvasNotice ? <div className="flow-canvas-notice">{canvasNotice}</div> : null}
            <ReactFlowProvider>
              <FlowCanvas
                nodes={nodes}
                edges={visibleEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                expandedTeamNodeIds={previewTeamNodeId ? [previewTeamNodeId] : []}
                onToggleTeamMembers={toggleTeamMembers}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setIsFlowSettingsOpen(false);
                  if (node.data.kind === "team") {
                    setPreviewTeamNodeId(node.id);
                  }
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setIsFlowSettingsOpen(true);
                  setNodeSelectorAnchor(null);
                  setPreviewTeamNodeId(null);
                }}
                onAddNodeClick={openNodeSelectorFromNode}
                onDeleteNodeClick={deleteNodeById}
                focusNodeId={focusNodeId}
                centerSignal={centerSignal}
              />
            </ReactFlowProvider>
            <TeamPreviewModal
              definition={previewTeamDefinition}
              title={previewTeamRecord ? `${previewTeamRecord.name} · Team 子图` : "Team 子图"}
              description={previewTeamRecord?.description}
              onClose={() => setPreviewTeamNodeId(null)}
              createNodesFromDefinition={createNodesFromDefinition}
              createEdgesFromDefinition={createEdgesFromDefinition}
            />
            <FlowNodeSelector
              anchor={nodeSelectorAnchor}
              onClose={() => setNodeSelectorAnchor(null)}
              onSelect={(kind, sourceNodeId) => addNode(kind, sourceNodeId)}
            />
          </section>

          <FlowSidePanel
            selectedNode={selectedNode}
            selectedFlow={selectedFlow}
            isOpen={Boolean(selectedNodeId || isFlowSettingsOpen)}
            setSelectedNodeId={setSelectedNodeId}
            setIsFlowSettingsOpen={setIsFlowSettingsOpen}
            updateSelectedNode={updateSelectedNode}
            saveSelectedAgent={saveSelectedAgent}
            isAgentSaving={isAgentSaving}
            agentForm={agentForm}
            agentOptions={agentOptions}
            teamOptions={teamOptions}
            previewTeamNodeId={previewTeamNodeId}
            toggleTeamMembers={toggleTeamMembers}
            nodes={nodes}
            setEdges={setEdges}
            selectedFlowHomeConfig={selectedFlowHomeConfig}
            updateSelectedFlowHomeConfig={updateSelectedFlowHomeConfig}
            joinPromptLines={joinPromptLines}
            splitPromptLines={splitPromptLines}
            updateSelectedFlow={updateSelectedFlow}
            isRunStreaming={isRunStreaming}
            runEvents={runEvents}
            runResult={runResult}
          />
        </div>
      </div>
    </section>
  );
}
