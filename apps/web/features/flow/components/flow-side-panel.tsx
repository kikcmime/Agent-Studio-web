"use client";

import { Field, FormProvider } from "@formily/react";
import type { Form } from "@formily/core";
import { addEdge, type Edge, type Node } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";

import { RunConsole } from "../../shared/components/run-console";
import type { BackendAgent, BackendAgentDetail, BackendRunDetail, BackendRunStreamEvent, BackendTeam } from "../model/flow-api";
import type { AgentDraft, FlowRecord, StudioFlowNode, StudioNodeData } from "./flow-studio-types";

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

export function FlowSidePanel(props: {
  selectedNode: StudioFlowNode | null;
  selectedFlow: FlowRecord;
  isOpen: boolean;
  setSelectedNodeId: (value: string | null) => void;
  setIsFlowSettingsOpen: (value: boolean) => void;
  updateSelectedNode: (patch: Partial<StudioNodeData>) => void;
  saveSelectedAgent: () => Promise<void>;
  isAgentSaving: boolean;
  agentForm: Form;
  agentOptions: BackendAgent[];
  teamOptions: BackendTeam[];
  previewTeamNodeId: string | null;
  toggleTeamMembers: (nodeId: string) => void;
  nodes: Node<StudioNodeData>[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  selectedFlowHomeConfig: {
    welcomeMessage?: string;
    starterPrompts?: string[];
  };
  updateSelectedFlowHomeConfig: (patch: {
    welcomeMessage?: string;
    starterPrompts?: string[];
  }) => void;
  joinPromptLines: (value?: string[]) => string;
  splitPromptLines: (value: string) => string[];
  updateSelectedFlow: (patch: Partial<Pick<FlowRecord, "name" | "description" | "flowType">>) => void;
  isRunStreaming: boolean;
  runEvents: BackendRunStreamEvent[];
  runResult: BackendRunDetail | null;
}) {
  const {
    selectedNode,
    selectedFlow,
    isOpen,
    setSelectedNodeId,
    setIsFlowSettingsOpen,
    updateSelectedNode,
    saveSelectedAgent,
    isAgentSaving,
    agentForm,
    agentOptions,
    teamOptions,
    previewTeamNodeId,
    toggleTeamMembers,
    nodes,
    setEdges,
    selectedFlowHomeConfig,
    updateSelectedFlowHomeConfig,
    joinPromptLines,
    splitPromptLines,
    updateSelectedFlow,
    isRunStreaming,
    runEvents,
    runResult,
  } = props;

  return (
    <aside className={`flow-editor-panel ${isOpen ? "is-open" : ""}`}>
      <div className="config-panel-head">
        <div className="config-panel-title">
          <strong>
            {selectedNode
              ? selectedNode.data.kind === "agent"
                ? "Agent 参数"
                : selectedNode.data.kind === "team"
                  ? "Team 参数"
                  : "节点配置"
              : "整体设置"}
          </strong>
          {selectedNode ? (
            <span>
              {selectedNode.data.kind} · {selectedNode.id}
            </span>
          ) : (
            <span>
              {selectedFlow.flowType} · {selectedFlow.id}
            </span>
          )}
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
                        onChange={(event) => {
                          const agent = agentOptions.find((item) => item.id === event.target.value);
                          updateSelectedNode({
                            agentId: event.target.value,
                            agentName: agent?.name ?? event.target.value,
                            label: agent?.name ?? event.target.value,
                          });
                        }}
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
                <>
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
                          memberCount: team?.member_agent_ids?.length ?? 0,
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
                  <button type="button" className="flow-secondary-button" onClick={() => toggleTeamMembers(selectedNode.id)}>
                    {previewTeamNodeId === selectedNode.id ? "关闭 Team 子图" : "查看 Team 子图"}
                  </button>
                </>
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
                        onChange={(event) =>
                          updateSelectedNode({
                            maxRetry: Number(event.target.value),
                          })
                        }
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
                        updateSelectedNode({
                          teamStrategy: event.target.value as "parallel" | "sequential",
                        })
                      }
                    >
                      <option value="parallel">parallel 并行</option>
                      <option value="sequential">sequential 串行</option>
                    </select>
                  </label>
                  <label className="flow-field flow-field-compact">
                    <span>成员 Agent IDs</span>
                    <input
                      value={(selectedNode.data.memberAgentIds ?? []).join(", ")}
                      onChange={(event) => {
                        const memberAgentIds = event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean);
                        updateSelectedNode({
                          memberAgentIds,
                          memberCount: memberAgentIds.length,
                        });
                      }}
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
                          branches: [
                            { id: "branch_1", label: "分支 1", conditionValue: "" },
                            { id: "branch_2", label: "分支 2", conditionValue: "" },
                          ],
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
                  {selectedNode.data.conditionType === "expression" ? (
                    <label className="flow-field flow-field-compact">
                      <span>表达式</span>
                      <input
                        value={selectedNode.data.expression ?? ""}
                        onChange={(event) => updateSelectedNode({ expression: event.target.value })}
                        placeholder="{{input.priority}} === 'high'"
                      />
                    </label>
                  ) : null}
                  {selectedNode.data.conditionType === "llm_classify" ? (
                    <>
                      <label className="flow-field flow-field-compact">
                        <span>模型</span>
                        <input
                          value={selectedNode.data.llmConfig?.model ?? "gpt-4.1-mini"}
                          onChange={(event) =>
                            updateSelectedNode({
                              llmConfig: {
                                ...selectedNode.data.llmConfig,
                                model: event.target.value,
                              } as StudioNodeData["llmConfig"],
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
                              llmConfig: {
                                ...selectedNode.data.llmConfig,
                                prompt: event.target.value,
                              } as StudioNodeData["llmConfig"],
                            })
                          }
                          placeholder="判断用户意图属于以下哪类..."
                        />
                      </label>
                    </>
                  ) : null}

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
                      {selectedNode.data.conditionType !== "expression" ? (
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
                      ) : null}
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
            <RunConsole title="Run Console" isRunning={isRunStreaming} events={runEvents} result={runResult} />
          </>
        ) : (
          <>
            <div className="config-panel-scroll">
              <div className="flow-settings-card">
                <div className="config-section-title">
                  <strong>数字人整体配置</strong>
                  <span>点击节点可切换到节点参数</span>
                </div>

                <label className="flow-field flow-field-compact">
                  <span>名称</span>
                  <input value={selectedFlow.name} onChange={(event) => updateSelectedFlow({ name: event.target.value })} />
                </label>

                <label className="flow-field flow-field-compact">
                  <span>类型</span>
                  <select
                    value={selectedFlow.flowType}
                    onChange={(event) =>
                      updateSelectedFlow({
                        flowType: event.target.value as "agent" | "team",
                      })
                    }
                  >
                    <option value="agent">Agent</option>
                    <option value="team">Team</option>
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

                <label className="flow-field flow-field-compact">
                  <span>首页欢迎文案</span>
                  <textarea
                    rows={4}
                    placeholder="进入运行台后，这个数字人先怎么介绍自己"
                    value={selectedFlowHomeConfig.welcomeMessage ?? ""}
                    onChange={(event) =>
                      updateSelectedFlowHomeConfig({
                        welcomeMessage: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="flow-field flow-field-compact">
                  <span>首页快捷提示</span>
                  <textarea
                    rows={4}
                    placeholder={"每行一个提示词，例如：\n介绍一下你的规则\n直接开始执行"}
                    value={joinPromptLines(selectedFlowHomeConfig.starterPrompts)}
                    onChange={(event) =>
                      updateSelectedFlowHomeConfig({
                        starterPrompts: splitPromptLines(event.target.value),
                      })
                    }
                  />
                </label>

                <div className="flow-settings-summary">
                  <span>节点数：{nodes.length}</span>
                  <span>Agent：{nodes.filter((node) => node.data.kind === "agent").length}</span>
                  <span>Team：{nodes.filter((node) => node.data.kind === "team").length}</span>
                </div>
              </div>
            </div>
            <RunConsole title="Run Console" isRunning={isRunStreaming} events={runEvents} result={runResult} />
          </>
        )}
      </div>
    </aside>
  );
}
