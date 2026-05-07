"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBackendAgent,
  createBackendFlow,
  createBackendTeam,
  deleteBackendAgent,
  deleteBackendFlow,
  deleteBackendTeam,
  getBackendAgent,
  getBackendFlow,
  getBackendTeam,
  listBackendAgents,
  listBackendFlows,
  listBackendTeams,
  updateBackendAgent,
  updateBackendFlow,
  updateBackendTeam,
  type BackendAgent,
  type BackendAgentDetail,
  type BackendFlowSummary,
  type BackendTeam,
} from "../../flow/model/flow-api";
import {
  type AgentAsset,
  buildWrapperDescription,
  createAgentWrapperDefinition,
  createTeamWrapperDefinition,
  inferAssetGroup,
  isLegacySelfBoundTeamWrapper,
  isStudioWrapperFlow,
  joinIds,
  parseWrapperDescription,
  splitIds,
} from "../lib/agent-assets";
import {
  readAssetDirectoryMap,
  readStoredDirectories,
  writeAssetDirectoryMap,
  writeStoredDirectories,
} from "../../workspace/lib/directory-storage";
import {
  readQueryParam,
  replaceRouteQuery,
} from "../../workspace/lib/router-state";

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

export function AgentsWorkspace({
  onOpenStudio,
  onRunFlow,
}: {
  onOpenStudio: (flowId: string) => void;
  onRunFlow: (flowId: string) => void;
}) {
  const [agents, setAgents] = useState<BackendAgent[]>([]);
  const [flows, setFlows] = useState<BackendFlowSummary[]>([]);
  const [teams, setTeams] = useState<BackendTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState(
    () => readQueryParam("dir") ?? "全部",
  );
  const [selectedAssetId, setSelectedAssetId] = useState(
    () => readQueryParam("asset") ?? "",
  );
  const [directories, setDirectories] = useState<string[]>(() =>
    readStoredDirectories(),
  );
  const [assetDirectoryMap, setAssetDirectoryMap] = useState<
    Record<string, string>
  >(() => readAssetDirectoryMap());
  const [editingAgent, setEditingAgent] = useState<BackendAgentDetail | null>(
    null,
  );
  const [editingTeam, setEditingTeam] = useState<BackendTeam | null>(null);
  const [isAgentEditorSaving, setIsAgentEditorSaving] = useState(false);
  const [isTeamEditorSaving, setIsTeamEditorSaving] = useState(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [newDirectoryName, setNewDirectoryName] = useState("");
  const [createAssetKind, setCreateAssetKind] = useState<
    "agent" | "team" | null
  >(null);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetDescription, setNewAssetDescription] = useState("");

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextAgents, nextFlows, nextTeams] = await Promise.all([
        listBackendAgents(),
        listBackendFlows(),
        listBackendTeams(),
      ]);
      setAgents(nextAgents);
      setFlows(nextFlows);
      setTeams(nextTeams);
    } catch (agentError) {
      setAgents([]);
      setFlows([]);
      setTeams([]);
      setError(
        agentError instanceof Error ? agentError.message : "读取数字人列表失败",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    writeStoredDirectories(directories);
  }, [directories]);

  useEffect(() => {
    writeAssetDirectoryMap(assetDirectoryMap);
  }, [assetDirectoryMap]);

  const assets = useMemo<AgentAsset[]>(() => {
    const flowAssets = flows
      .filter((flow) => !isStudioWrapperFlow(flow))
      .map((flow) => ({
        id: `flow:${flow.id}`,
        name: flow.name,
        description: flow.description || "已发布的可执行数字人。",
        kind:
          flow.flow_type === "team" ? ("team" as const) : ("agent" as const),
        source: "flow" as const,
        status: flow.status,
        targetId: flow.id,
        updatedAt: formatBackendTime(flow.updated_at ?? flow.created_at),
        group:
          assetDirectoryMap[`flow:${flow.id}`] ||
          inferAssetGroup(flow.name, flow.description),
        meta: [`v${flow.latest_version}`, "可编排"],
      }));

    const teamAssets = teams.map((team) => ({
      id: `team:${team.id}`,
      name: team.name,
      description:
        team.description || "Team 数字人，可独立运行，也可被更大的 Team 复用。",
      kind: "team" as const,
      source: "team" as const,
      status: team.status,
      targetId: team.id,
      updatedAt: formatBackendTime(team.updated_at),
      group:
        assetDirectoryMap[`team:${team.id}`] ||
        inferAssetGroup(team.name, team.description),
      meta: [
        `${team.member_agent_ids.length} 个成员`,
        team.strategy === "parallel" ? "并行" : "串行",
      ],
    }));

    const agentAssets = agents.map((agent) => ({
      id: `agent:${agent.id}`,
      name: agent.name,
      description:
        agent.description ||
        agent.role ||
        "单个可执行数字人，可绑定模型、工具与知识库。",
      kind: "agent" as const,
      source: "agent" as const,
      status: agent.status,
      targetId: agent.id,
      updatedAt: "Just now",
      group:
        assetDirectoryMap[`agent:${agent.id}`] ||
        inferAssetGroup(agent.name, agent.description),
      meta: [
        agent.stream ? "流式输出" : "普通输出",
        agent.owner_user_id || "local",
      ],
    }));

    return [...flowAssets, ...teamAssets, ...agentAssets];
  }, [agents, assetDirectoryMap, flows, teams]);

  const groups = useMemo(
    () =>
      Array.from(
        new Set([
          "全部",
          ...directories,
          ...assets.map((asset) => asset.group),
        ]),
      ),
    [assets, directories],
  );

  const visibleAssets = useMemo(
    () =>
      selectedDirectory === "全部"
        ? assets
        : assets.filter((asset) => asset.group === selectedDirectory),
    [assets, selectedDirectory],
  );

  const flowByAssetId = useMemo(() => {
    const pairs = new Map<string, BackendFlowSummary>();

    flows.forEach((flow) => {
      if (!isStudioWrapperFlow(flow)) {
        pairs.set(`flow:${flow.id}`, flow);
        return;
      }

      const parsed = parseWrapperDescription(flow.description);
      if (!parsed) {
        return;
      }
      pairs.set(`${parsed.source}:${parsed.targetId}`, flow);
    });

    return pairs;
  }, [flows]);

  useEffect(() => {
    replaceRouteQuery({
      dir: selectedDirectory === "全部" ? null : selectedDirectory,
      asset: selectedAssetId || null,
    });
  }, [selectedAssetId, selectedDirectory]);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }
    const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
    if (!selectedAsset) {
      setSelectedAssetId("");
      return;
    }
    if (
      selectedDirectory !== "全部" &&
      selectedAsset.group !== selectedDirectory
    ) {
      setSelectedDirectory(selectedAsset.group);
    }
  }, [assets, selectedAssetId, selectedDirectory]);

  useEffect(() => {
    const restoreAgentsState = () => {
      setSelectedDirectory(readQueryParam("dir") ?? "全部");
      setSelectedAssetId(readQueryParam("asset") ?? "");
    };

    window.addEventListener("popstate", restoreAgentsState);
    return () => window.removeEventListener("popstate", restoreAgentsState);
  }, []);

  const openSingleAgentEditor = async (agentId: string) => {
    setSelectedAssetId(`agent:${agentId}`);
    setError(null);
    try {
      setEditingAgent(await getBackendAgent(agentId));
    } catch (agentError) {
      setError(
        agentError instanceof Error
          ? agentError.message
          : "读取 Agent 配置失败",
      );
    }
  };

  const openTeamEditor = async (teamId: string) => {
    setSelectedAssetId(`team:${teamId}`);
    setError(null);
    try {
      setEditingTeam(await getBackendTeam(teamId));
    } catch (teamError) {
      setError(
        teamError instanceof Error ? teamError.message : "读取 Team 配置失败",
      );
    }
  };

  const saveSingleAgentEditor = async () => {
    if (!editingAgent) return;
    setIsAgentEditorSaving(true);
    setError(null);
    try {
      const updated = await updateBackendAgent(editingAgent.id, {
        name: editingAgent.name,
        description: editingAgent.description,
        instructions: editingAgent.instructions,
        model_config: editingAgent.model_config,
        tool_ids: editingAgent.tool_ids,
        skill_ids: editingAgent.skill_ids,
        knowledge_ids: editingAgent.knowledge_ids,
        stream: editingAgent.stream,
        debug: editingAgent.debug,
      });
      setEditingAgent(updated);
      setAgents((current) =>
        current.map((agent) =>
          agent.id === updated.id ? { ...agent, ...updated } : agent,
        ),
      );
    } catch (agentError) {
      setError(
        agentError instanceof Error
          ? agentError.message
          : "保存 Agent 配置失败",
      );
    } finally {
      setIsAgentEditorSaving(false);
    }
  };

  const saveTeamEditor = async () => {
    if (!editingTeam) return;
    setIsTeamEditorSaving(true);
    setError(null);
    try {
      const updated = await updateBackendTeam(editingTeam.id, {
        name: editingTeam.name,
        description: editingTeam.description,
        strategy: editingTeam.strategy,
        member_agent_ids: editingTeam.member_agent_ids,
        status: editingTeam.status,
      });
      setEditingTeam(updated);
      setTeams((current) =>
        current.map((team) => (team.id === updated.id ? updated : team)),
      );
    } catch (teamError) {
      setError(
        teamError instanceof Error ? teamError.message : "保存 Team 配置失败",
      );
    } finally {
      setIsTeamEditorSaving(false);
    }
  };

  const createDirectory = () => {
    const normalizedName = newDirectoryName.trim();
    if (!normalizedName) return;
    setDirectories((current) =>
      Array.from(new Set([...current, normalizedName])),
    );
    setSelectedDirectory(normalizedName);
    setSelectedAssetId("");
    setNewDirectoryName("");
    setIsDirectoryModalOpen(false);
  };

  const createAsset = async () => {
    if (!createAssetKind) return;
    const normalizedName = newAssetName.trim();
    if (!normalizedName) return;

    setError(null);
    try {
      if (createAssetKind === "agent") {
        const created = await createBackendAgent({
          name: normalizedName,
          description: newAssetDescription.trim() || null,
          instructions: `你是 ${normalizedName}，请简洁完成分配给你的任务。`,
          model_config: {
            provider: "openai_compatible",
            model: "deepseek-v3.1-ksyun",
            temperature: 0.2,
            extra: {},
          },
          owner_user_id: "local_user",
          workspace_id: "local_workspace",
          stream: true,
          debug: false,
        });
        setAgents((current) => [created, ...current]);
        setAssetDirectoryMap((current) => ({
          ...current,
          [`agent:${created.id}`]:
            selectedDirectory === "全部" ? "未分组" : selectedDirectory,
        }));
        setSelectedAssetId(`agent:${created.id}`);
      } else {
        const created = await createBackendTeam({
          name: normalizedName,
          description: newAssetDescription.trim() || null,
          owner_user_id: "local_user",
          workspace_id: "local_workspace",
          strategy: "parallel",
          member_agent_ids: [],
          status: "active",
        });
        setTeams((current) => [created, ...current]);
        setAssetDirectoryMap((current) => ({
          ...current,
          [`team:${created.id}`]:
            selectedDirectory === "全部" ? "未分组" : selectedDirectory,
        }));
        setSelectedAssetId(`team:${created.id}`);
      }

      setCreateAssetKind(null);
      setNewAssetName("");
      setNewAssetDescription("");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "创建数字人失败",
      );
    }
  };

  const deleteAsset = async (asset: AgentAsset) => {
    const assetLabel =
      asset.source === "flow"
        ? "Flow"
        : asset.source === "team"
          ? "Team"
          : "Agent";
    if (!window.confirm(`确定删除${assetLabel}“${asset.name}”吗？`)) {
      return;
    }

    setError(null);
    try {
      if (asset.source === "agent") {
        await deleteBackendAgent(asset.targetId);
      } else if (asset.source === "team") {
        await deleteBackendTeam(asset.targetId);
      } else {
        await deleteBackendFlow(asset.targetId);
      }

      setAgents((current) =>
        asset.source === "agent"
          ? current.filter((agent) => agent.id !== asset.targetId)
          : current,
      );
      setTeams((current) => {
        if (asset.source === "team") {
          return current.filter((team) => team.id !== asset.targetId);
        }
        if (asset.source === "agent") {
          return current.map((team) => ({
            ...team,
            member_agent_ids: team.member_agent_ids.filter(
              (memberId) => memberId !== asset.targetId,
            ),
          }));
        }
        return current;
      });
      setFlows((current) => {
        if (asset.source === "flow") {
          return current.filter((flow) => flow.id !== asset.targetId);
        }
        return current.filter((flow) => {
          const parsed = parseWrapperDescription(flow.description);
          return !(
            parsed?.source === asset.source &&
            parsed.targetId === asset.targetId
          );
        });
      });
      setAssetDirectoryMap((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      setSelectedAssetId((current) => (current === asset.id ? "" : current));
      setEditingAgent((current) =>
        asset.source === "agent" && current?.id === asset.targetId
          ? null
          : current,
      );
      setEditingTeam((current) =>
        asset.source === "team" && current?.id === asset.targetId
          ? null
          : current,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "删除数字人失败",
      );
    }
  };

  const applyFlowExposure = async (
    flowId: string,
    patch: { is_exposed?: boolean; is_primary?: boolean },
  ) => {
    const updated = await updateBackendFlow(flowId, patch);
    setFlows((current) =>
      current.map((flow) => {
        if (flow.id === updated.id) {
          return updated;
        }
        if (patch.is_primary && flow.id !== updated.id) {
          const currentAsset = assets.find(
            (asset) => flowByAssetId.get(asset.id)?.id === flow.id,
          );
          const updatedAsset = assets.find(
            (asset) =>
              asset.id === selectedAssetId ||
              flowByAssetId.get(asset.id)?.id === updated.id,
          );
          if (
            currentAsset &&
            updatedAsset &&
            currentAsset.group === updatedAsset.group
          ) {
            return { ...flow, is_primary: false };
          }
        }
        return flow;
      }),
    );
    return updated;
  };

  const ensureStudioFlow = async (asset: AgentAsset) => {
    if (asset.source === "flow") return asset.targetId;

    const existingWrapper = flows.find((flow) => {
      const parsed = parseWrapperDescription(flow.description);
      return (
        parsed?.source === asset.source && parsed.targetId === asset.targetId
      );
    });
    if (existingWrapper) {
      if (asset.source === "team") {
        const team = teams.find((item) => item.id === asset.targetId);
        if (!team) throw new Error("未找到对应 Team");

        const wrapperFlow = await getBackendFlow(existingWrapper.id);
        if (isLegacySelfBoundTeamWrapper(wrapperFlow, team.id)) {
          const migrated = await updateBackendFlow(existingWrapper.id, {
            definition: createTeamWrapperDefinition(team, agents),
          });
          setFlows((current) =>
            current.map((flow) => (flow.id === migrated.id ? migrated : flow)),
          );
        }
      }

      return existingWrapper.id;
    }

    if (asset.source === "agent") {
      const agent = agents.find((item) => item.id === asset.targetId);
      if (!agent) throw new Error("未找到对应 Agent");
      const created = await createBackendFlow({
        name: asset.name,
        description: buildWrapperDescription("agent", asset.targetId),
        flow_type: "agent",
        owner_user_id: "local_user",
        workspace_id: "local_workspace",
        definition: createAgentWrapperDefinition(agent),
      });
      setFlows((current) => [created, ...current]);
      return created.id;
    }

    const team = teams.find((item) => item.id === asset.targetId);
    if (!team) throw new Error("未找到对应 Team");
    const created = await createBackendFlow({
      name: asset.name,
      description: buildWrapperDescription("team", asset.targetId),
      flow_type: "team",
      owner_user_id: "local_user",
      workspace_id: "local_workspace",
      definition: createTeamWrapperDefinition(team, agents),
    });
    setFlows((current) => [created, ...current]);
    return created.id;
  };

  const setAssetExposure = async (
    asset: AgentAsset,
    mode: "expose" | "hide" | "primary",
  ) => {
    setSelectedAssetId(asset.id);
    setError(null);
    try {
      const flowId =
        asset.source === "flow"
          ? asset.targetId
          : await ensureStudioFlow(asset);
      const targetFlow = flows.find((flow) => flow.id === flowId);
      const targetGroup = asset.group;

      if (mode === "primary") {
        const flowsInSameGroup = assets
          .filter((item) => item.group === targetGroup)
          .map((item) => flowByAssetId.get(item.id))
          .filter((item): item is BackendFlowSummary => Boolean(item));

        await Promise.all(
          flowsInSameGroup
            .filter((flow) => flow.id !== flowId && flow.is_primary)
            .map((flow) => updateBackendFlow(flow.id, { is_primary: false })),
        );

        setFlows((current) =>
          current.map((flow) =>
            flowsInSameGroup.some((item) => item.id === flow.id) &&
            flow.id !== flowId
              ? { ...flow, is_primary: false }
              : flow,
          ),
        );

        await applyFlowExposure(flowId, { is_exposed: true, is_primary: true });
        await loadAssets();
        return;
      }

      await applyFlowExposure(flowId, {
        is_exposed: mode === "expose",
        is_primary: mode === "hide" ? false : targetFlow?.is_primary,
      });
      await loadAssets();
    } catch (exposureError) {
      setError(
        exposureError instanceof Error
          ? exposureError.message
          : "更新对外入口失败",
      );
    }
  };

  const editAsset = async (asset: AgentAsset) => {
    setSelectedAssetId(asset.id);
    try {
      onOpenStudio(await ensureStudioFlow(asset));
    } catch (assetError) {
      setError(
        assetError instanceof Error ? assetError.message : "进入 Studio 失败",
      );
    }
  };

  const runAsset = async (asset: AgentAsset) => {
    setSelectedAssetId(asset.id);
    try {
      onRunFlow(await ensureStudioFlow(asset));
    } catch (assetError) {
      setError(
        assetError instanceof Error ? assetError.message : "运行数字人失败",
      );
    }
  };

  return (
    <section className="workspace-canvas workspace-canvas-plain">
      <div className="content-doc content-doc-flow agent-hub-page">
        <div className="flow-page-header">
          <div>
            <h2>我的数字人</h2>
            <p>
              目录负责组织资产；Agent 和 Team
              都是数字人，都可以运行、配置、编排。
            </p>
          </div>
          <div className="flow-header-actions">
            <button
              type="button"
              className="flow-secondary-button"
              onClick={() => void loadAssets()}
              disabled={isLoading}
            >
              {isLoading ? "刷新中" : "刷新"}
            </button>
            <button
              type="button"
              className="flow-secondary-button"
              onClick={() => setIsDirectoryModalOpen(true)}
            >
              新建目录
            </button>
            {selectedDirectory !== "全部" ? (
              <>
                <button
                  type="button"
                  className="flow-secondary-button"
                  onClick={() => setCreateAssetKind("agent")}
                >
                  新建 Agent
                </button>
                <button
                  type="button"
                  className="flow-primary-button"
                  onClick={() => setCreateAssetKind("team")}
                >
                  新建 Team
                </button>
              </>
            ) : null}
          </div>
        </div>

        {error ? <div className="flow-error">{error}</div> : null}

        <div className="agent-hub-summary">
          <span>{assets.length} 个数字人</span>
          <span>
            {assets.filter((asset) => asset.kind === "agent").length} 个 Agent
          </span>
          <span>
            {assets.filter((asset) => asset.kind === "team").length} 个 Team
          </span>
          <span>
            {
              assets.filter(
                (asset) =>
                  asset.status === "active" || asset.status === "draft",
              ).length
            }{" "}
            个可用中
          </span>
        </div>

        <div className="agent-asset-layout">
          <aside className="agent-folder-panel">
            <strong>数字人目录</strong>
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                className={selectedDirectory === group ? "is-active" : ""}
                onClick={() => {
                  setSelectedDirectory(group);
                  const selectedAsset = assets.find(
                    (asset) => asset.id === selectedAssetId,
                  );
                  if (
                    selectedAsset &&
                    group !== "全部" &&
                    selectedAsset.group !== group
                  ) {
                    setSelectedAssetId("");
                  }
                }}
              >
                <span>{group}</span>
                <small>
                  {group === "全部"
                    ? assets.length
                    : assets.filter((asset) => asset.group === group).length}
                </small>
              </button>
            ))}
          </aside>

          <div className="flow-list-card agent-hub-list">
            {isLoading ? (
              <div className="empty-flow-card">
                <strong>正在加载数字人</strong>
                <p>从后端读取 Agent 和 Team。</p>
              </div>
            ) : visibleAssets.length === 0 ? (
              <div className="empty-flow-card">
                <strong>暂无数字人</strong>
                <p>
                  {selectedDirectory === "全部"
                    ? "请先创建一个目录，再在目录下创建 Agent 或 Team。"
                    : "当前目录下还没有数字人。你可以先创建 Agent 或 Team。"}
                </p>
              </div>
            ) : (
              visibleAssets.map((asset) => {
                const linkedFlow = flowByAssetId.get(asset.id);

                return (
                  <article
                    key={asset.id}
                    className={`agent-row agent-hub-row ${selectedAssetId === asset.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <div className="agent-row-main">
                      <span
                        className={`agent-status ${asset.kind === "team" ? "agent-status-team" : "agent-status-active"}`}
                      />
                      <div>
                        <strong>{asset.name}</strong>
                        <p>{asset.description}</p>
                      </div>
                    </div>
                    <div className="agent-row-meta">
                      <span>{asset.kind === "team" ? "Team" : "Agent"}</span>
                      <span>{asset.status}</span>
                      <span>{asset.group}</span>
                      {asset.meta.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                      {linkedFlow?.is_exposed ? <span>已暴露</span> : null}
                      {linkedFlow?.is_primary ? <span>主入口</span> : null}
                    </div>
                    <div className="agent-row-actions">
                      <button
                        type="button"
                        className="agent-link-button"
                        onClick={() => void runAsset(asset)}
                      >
                        运行
                      </button>
                      {asset.source === "agent" ? (
                        <button
                          type="button"
                          className="agent-link-button"
                          onClick={() =>
                            void openSingleAgentEditor(asset.targetId)
                          }
                        >
                          配置
                        </button>
                      ) : asset.source === "team" ? (
                        <button
                          type="button"
                          className="agent-link-button"
                          onClick={() => void openTeamEditor(asset.targetId)}
                        >
                          配置
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="agent-link-button"
                        onClick={() => void editAsset(asset)}
                      >
                        编排
                      </button>
                      <button
                        type="button"
                        className="agent-link-button"
                        onClick={() =>
                          void setAssetExposure(
                            asset,
                            linkedFlow?.is_exposed ? "hide" : "expose",
                          )
                        }
                      >
                        {linkedFlow?.is_exposed ? "取消暴露" : "对外暴露"}
                      </button>
                      <button
                        type="button"
                        className="agent-link-button"
                        disabled={Boolean(linkedFlow?.is_primary)}
                        onClick={() => void setAssetExposure(asset, "primary")}
                      >
                        {linkedFlow?.is_primary ? "当前主入口" : "设为主入口"}
                      </button>
                      <button
                        type="button"
                        className="agent-link-button"
                        onClick={() => void deleteAsset(asset)}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {isDirectoryModalOpen ? (
          <div className="agent-editor-overlay" role="dialog" aria-modal="true">
            <div className="agent-editor-panel">
              <div className="flow-modal-header">
                <strong>新建目录</strong>
                <button
                  type="button"
                  className="agent-link-button"
                  onClick={() => setIsDirectoryModalOpen(false)}
                >
                  关闭
                </button>
              </div>
              <label className="flow-field">
                <span>目录名称</span>
                <input
                  value={newDirectoryName}
                  onChange={(event) => setNewDirectoryName(event.target.value)}
                  placeholder="例如：客服中心"
                />
              </label>
              <button
                type="button"
                className="flow-primary-button agent-editor-save"
                onClick={createDirectory}
                disabled={!newDirectoryName.trim()}
              >
                创建目录
              </button>
            </div>
          </div>
        ) : null}

        {createAssetKind ? (
          <div className="agent-editor-overlay" role="dialog" aria-modal="true">
            <div className="agent-editor-panel">
              <div className="flow-modal-header">
                <strong>
                  新建 {createAssetKind === "agent" ? "Agent" : "Team"}
                </strong>
                <button
                  type="button"
                  className="agent-link-button"
                  onClick={() => setCreateAssetKind(null)}
                >
                  关闭
                </button>
              </div>
              <label className="flow-field">
                <span>归属目录</span>
                <input value={selectedDirectory} readOnly />
              </label>
              <label className="flow-field">
                <span>名称</span>
                <input
                  value={newAssetName}
                  onChange={(event) => setNewAssetName(event.target.value)}
                  placeholder={
                    createAssetKind === "agent"
                      ? "例如：售前顾问 Agent"
                      : "例如：客服 Team"
                  }
                />
              </label>
              <label className="flow-field">
                <span>描述</span>
                <textarea
                  value={newAssetDescription}
                  onChange={(event) =>
                    setNewAssetDescription(event.target.value)
                  }
                  rows={3}
                />
              </label>
              <button
                type="button"
                className="flow-primary-button agent-editor-save"
                onClick={() => void createAsset()}
                disabled={!newAssetName.trim()}
              >
                创建 {createAssetKind === "agent" ? "Agent" : "Team"}
              </button>
            </div>
          </div>
        ) : null}

        {editingAgent ? (
          <div className="agent-editor-overlay" role="dialog" aria-modal="true">
            <div className="agent-editor-panel">
              <div className="flow-modal-header">
                <strong>配置 Agent</strong>
                <button
                  type="button"
                  className="agent-link-button"
                  onClick={() => setEditingAgent(null)}
                >
                  关闭
                </button>
              </div>
              <label className="flow-field">
                <span>名称</span>
                <input
                  value={editingAgent.name}
                  onChange={(event) =>
                    setEditingAgent({
                      ...editingAgent,
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label className="flow-field">
                <span>描述</span>
                <textarea
                  value={editingAgent.description ?? ""}
                  onChange={(event) =>
                    setEditingAgent({
                      ...editingAgent,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                />
              </label>
              <label className="flow-field">
                <span>指令</span>
                <textarea
                  value={editingAgent.instructions ?? ""}
                  onChange={(event) =>
                    setEditingAgent({
                      ...editingAgent,
                      instructions: event.target.value,
                    })
                  }
                  rows={5}
                />
              </label>
              <div className="agent-config-grid">
                <label className="flow-field">
                  <span>模型</span>
                  <input
                    value={editingAgent.model_config.model}
                    onChange={(event) =>
                      setEditingAgent({
                        ...editingAgent,
                        model_config: {
                          ...editingAgent.model_config,
                          model: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="flow-field">
                  <span>温度</span>
                  <input
                    type="number"
                    step="0.1"
                    value={editingAgent.model_config.temperature ?? 0.2}
                    onChange={(event) =>
                      setEditingAgent({
                        ...editingAgent,
                        model_config: {
                          ...editingAgent.model_config,
                          temperature: Number(event.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
              <div className="agent-config-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editingAgent.stream)}
                    onChange={(event) =>
                      setEditingAgent({
                        ...editingAgent,
                        stream: event.target.checked,
                      })
                    }
                  />
                  流式输出
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editingAgent.debug)}
                    onChange={(event) =>
                      setEditingAgent({
                        ...editingAgent,
                        debug: event.target.checked,
                      })
                    }
                  />
                  调试
                </label>
              </div>
              <button
                type="button"
                className="flow-primary-button agent-editor-save"
                onClick={() => void saveSingleAgentEditor()}
                disabled={isAgentEditorSaving}
              >
                {isAgentEditorSaving ? "保存中..." : "保存 Agent"}
              </button>
            </div>
          </div>
        ) : null}

        {editingTeam ? (
          <div className="agent-editor-overlay" role="dialog" aria-modal="true">
            <div className="agent-editor-panel">
              <div className="flow-modal-header">
                <strong>配置 Team</strong>
                <button
                  type="button"
                  className="agent-link-button"
                  onClick={() => setEditingTeam(null)}
                >
                  关闭
                </button>
              </div>
              <label className="flow-field">
                <span>名称</span>
                <input
                  value={editingTeam.name}
                  onChange={(event) =>
                    setEditingTeam({ ...editingTeam, name: event.target.value })
                  }
                />
              </label>
              <label className="flow-field">
                <span>描述</span>
                <textarea
                  value={editingTeam.description ?? ""}
                  onChange={(event) =>
                    setEditingTeam({
                      ...editingTeam,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                />
              </label>
              <label className="flow-field">
                <span>执行策略</span>
                <select
                  value={editingTeam.strategy}
                  onChange={(event) =>
                    setEditingTeam({
                      ...editingTeam,
                      strategy: event.target.value as "parallel" | "sequential",
                    })
                  }
                >
                  <option value="parallel">parallel 并行</option>
                  <option value="sequential">sequential 串行</option>
                </select>
              </label>
              <label className="flow-field">
                <span>成员 Agent IDs</span>
                <input
                  value={joinIds(editingTeam.member_agent_ids)}
                  onChange={(event) =>
                    setEditingTeam({
                      ...editingTeam,
                      member_agent_ids: splitIds(event.target.value),
                    })
                  }
                  placeholder="agent_a, agent_b"
                />
              </label>
              <button
                type="button"
                className="flow-primary-button agent-editor-save"
                onClick={() => void saveTeamEditor()}
                disabled={isTeamEditorSaving}
              >
                {isTeamEditorSaving ? "保存中..." : "保存 Team"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
