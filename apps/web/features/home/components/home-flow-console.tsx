"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listBackendFlows,
  runBackendFlow,
  streamBackendFlowRun,
  type BackendFlowSummary,
  type BackendRunDetail,
  type BackendRunStreamEvent,
} from "../../flow/model/flow-api";
import { RunConsole } from "../../shared/components/run-console";
import { stringifyRunOutput } from "../../shared/lib/run-output";
import {
  readHomeConsoleConfigMap,
  type HomeConsoleConfig,
} from "../../workspace/lib/directory-storage";

type HomeChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actorName: string;
};

const DEFAULT_HOME_PROMPT = "";

type HomeFlowPreset = {
  intro: string;
  suggestions: string[];
  switchNotice?: string;
};

const DEFAULT_HOME_FLOW_PRESET: HomeFlowPreset = {
  intro: "输入一个任务，我会以流式方式运行当前数字人，并在本页面保留短期上下文。",
  suggestions: ["你可以帮我干啥", "介绍一下这个数字人的规则", "先给我一个示例任务"],
  switchNotice: "已切换数字人，并清空上一段会话上下文。",
};

const HOME_FLOW_PRESETS: Record<string, HomeFlowPreset> = {
  flow_rps_team: {
    intro: "这是一个三人剪刀石头布数字人。你可以先问规则，也可以直接让我开始一局，系统会在平局时自动续局直到分出结果。",
    suggestions: ["介绍一下这个数字人的规则", "开始一局剪刀石头布", "直接来三局看看结果"],
    switchNotice: "已切换到剪刀石头布数字人，并清空上一段会话上下文。",
  },
  flow_doudizhu_team: {
    intro: "这是一个斗地主回溯演示数字人。你可以查看玩法分工，也可以直接发起一局，让荷官、玩家和裁判按编排协作。",
    suggestions: ["介绍一下这个数字人的规则", "开始一局斗地主", "说说这个数字人是怎么分工的"],
    switchNotice: "已切换到斗地主数字人，并清空上一段会话上下文。",
  },
};

const TABLE_ROW_PATTERN = /\|/;
const TABLE_DIVIDER_PATTERN = /^[:\-\s|]+$/;
const ORDERED_LIST_PATTERN = /^\d+\.\s+/;
const BULLET_LIST_PATTERN = /^[-*]\s+/;

const parseTableRow = (line: string) =>
  line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, items) => {
      if (items.length === 1) {
        return cell.length > 0;
      }

      const isLeadingEmpty = index === 0 && cell === "";
      const isTrailingEmpty = index === items.length - 1 && cell === "";
      return !isLeadingEmpty && !isTrailingEmpty;
    });

const renderAssistantContent = (content: string) => {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const nonEmptyLines = lines.filter(Boolean);
    const looksLikeTable =
      nonEmptyLines.length >= 2 &&
      nonEmptyLines.every((line) => TABLE_ROW_PATTERN.test(line));

    if (looksLikeTable) {
      const rows = nonEmptyLines.map(parseTableRow).filter((row) => row.length > 0);
      const dividerIndex = rows.findIndex((row) =>
        row.every((cell) => TABLE_DIVIDER_PATTERN.test(cell)),
      );
      const header = dividerIndex > 0 ? rows[dividerIndex - 1] : rows[0];
      const bodyRows = dividerIndex > 0 ? rows.slice(dividerIndex + 1) : rows.slice(1);

      if (header.length > 0 && bodyRows.length > 0) {
        return (
          <div key={`${index}_${block.slice(0, 12)}`} className="home-message-table-wrap">
            <table className="home-message-table">
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={`${cell}_${cellIndex}`}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIndex) => (
                  <tr key={`${row.join("_")}_${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}_${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return (
        <pre key={`${index}_${block.slice(0, 12)}`} className="home-message-pre">
          {nonEmptyLines.join("\n")}
        </pre>
      );
    }

    const orderedItems = nonEmptyLines.filter((line) => ORDERED_LIST_PATTERN.test(line));
    if (orderedItems.length === nonEmptyLines.length && orderedItems.length > 0) {
      return (
        <ol key={`${index}_${block.slice(0, 12)}`} className="home-message-list">
          {orderedItems.map((line) => (
            <li key={line}>{line.replace(ORDERED_LIST_PATTERN, "")}</li>
          ))}
        </ol>
      );
    }

    const bulletItems = nonEmptyLines.filter((line) => BULLET_LIST_PATTERN.test(line));
    if (bulletItems.length === nonEmptyLines.length && bulletItems.length > 0) {
      return (
        <ul key={`${index}_${block.slice(0, 12)}`} className="home-message-list">
          {bulletItems.map((line) => (
            <li key={line}>{line.replace(BULLET_LIST_PATTERN, "")}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`${index}_${block.slice(0, 12)}`} className="home-message-paragraph">
        {block}
      </p>
    );
  });
};

function getHomeFlowPreset(flow?: BackendFlowSummary, customConfig?: HomeConsoleConfig): HomeFlowPreset {
  if (!flow) return DEFAULT_HOME_FLOW_PRESET;
  const basePreset = HOME_FLOW_PRESETS[flow.id]
    ? HOME_FLOW_PRESETS[flow.id]
    : flow.name.includes("剪刀石头布")
      ? HOME_FLOW_PRESETS.flow_rps_team
      : flow.name.includes("斗地主")
        ? HOME_FLOW_PRESETS.flow_doudizhu_team
        : {
            ...DEFAULT_HOME_FLOW_PRESET,
            intro: flow.description?.trim() || DEFAULT_HOME_FLOW_PRESET.intro,
            switchNotice: `已切换到“${flow.name}”，并清空上一段会话上下文。`,
          };

  return {
    ...basePreset,
    intro: customConfig?.welcomeMessage?.trim() || basePreset.intro,
    suggestions:
      customConfig?.starterPrompts?.filter((item) => item.trim().length > 0)
        .map((item) => item.trim()) || basePreset.suggestions,
  };
}


export function HomeFlowConsole() {
  const [flows, setFlows] = useState<BackendFlowSummary[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_HOME_PROMPT);
  const [messages, setMessages] = useState<HomeChatMessage[]>([]);
  const [events, setEvents] = useState<BackendRunStreamEvent[]>([]);
  const [result, setResult] = useState<BackendRunDetail | null>(null);
  const [homeConsoleConfigMap, setHomeConsoleConfigMap] = useState<Record<string, HomeConsoleConfig>>(() => readHomeConsoleConfigMap());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [switchNotice, setSwitchNotice] = useState("");
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollChatToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const stream = chatStreamRef.current;
      if (!stream) {
        return;
      }

      stream.scrollTo({
        top: stream.scrollHeight,
        behavior,
      });
    },
    [],
  );

  const handleChatScroll = useCallback(() => {
    const stream = chatStreamRef.current;
    if (!stream) {
      return;
    }

    const distanceToBottom =
      stream.scrollHeight - stream.scrollTop - stream.clientHeight;
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
        const backendFlows = (await listBackendFlows()).filter(
          (flow) => flow.is_exposed,
        );
        const primaryFlow = backendFlows.find((flow) => flow.is_primary);

        if (!mounted) {
          return;
        }

        setFlows(backendFlows);
        setSelectedFlowId((current) =>
          current && backendFlows.some((flow) => flow.id === current)
            ? current
            : primaryFlow?.id || backendFlows[0]?.id || "",
        );
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : "读取数字人失败",
          );
        }
      }
    }

    void loadFlows();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId);
  useEffect(() => {
    const syncHomeConsoleConfig = () => setHomeConsoleConfigMap(readHomeConsoleConfigMap());
    window.addEventListener("agent-studio:home-console-config-changed", syncHomeConsoleConfig);
    window.addEventListener("storage", syncHomeConsoleConfig);
    return () => {
      window.removeEventListener("agent-studio:home-console-config-changed", syncHomeConsoleConfig);
      window.removeEventListener("storage", syncHomeConsoleConfig);
    };
  }, []);

  const selectedFlowPreset = useMemo(() => getHomeFlowPreset(selectedFlow, selectedFlow ? homeConsoleConfigMap[selectedFlow.id] : undefined), [homeConsoleConfigMap, selectedFlow]);

  const clearConversationState = useCallback(() => {
    setMessages([]);
    setEvents([]);
    setResult(null);
    setError("");
    setSwitchNotice("");
    shouldAutoScrollRef.current = true;
  }, []);

  const switchFlow = useCallback(
    (nextFlowId: string) => {
      if (!nextFlowId || nextFlowId === selectedFlowId || isRunning) {
        return;
      }

      const nextFlow = flows.find((flow) => flow.id === nextFlowId);
      const hasContext =
        messages.length > 0 || events.length > 0 || result !== null || prompt.trim().length > 0;

      if (hasContext) {
        const confirmed = window.confirm(
          `切换到“${nextFlow?.name ?? "新数字人"}”会清空当前对话、事件流和临时上下文，继续吗？`,
        );

        if (!confirmed) {
          return;
        }
      }

      clearConversationState();
      setPrompt("");
      setSelectedFlowId(nextFlowId);
      setSwitchNotice(nextFlow ? getHomeFlowPreset(nextFlow).switchNotice ?? `已切换到“${nextFlow.name}”，并清空上一段会话上下文。` : DEFAULT_HOME_FLOW_PRESET.switchNotice ?? "已切换数字人，并清空上一段会话上下文。");
    },
    [clearConversationState, events.length, flows, isRunning, messages.length, prompt, result, selectedFlowId],
  );

  const runSelectedFlow = async (nextPrompt?: string) => {
    const userText = (nextPrompt ?? prompt).trim();
    if (!selectedFlow || !userText || isRunning) {
      return;
    }
    const history = messages;
    const assistantMessageId = `assistant_${Date.now()}`;
    setEvents([]);
    setResult(null);
    setError("");
    setSwitchNotice("");
    setIsRunning(true);
    setPrompt("");
    shouldAutoScrollRef.current = true;
    setMessages((current) => [
      ...current,
      {
        id: `user_${Date.now()}`,
        role: "user",
        content: userText,
        actorName: "你",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        actorName: selectedFlow.name,
      },
    ]);
    requestAnimationFrame(() => scrollChatToBottom("smooth"));

    try {
      let streamedResult: BackendRunDetail | null = null;

      await streamBackendFlowRun(
        selectedFlow.id,
        {
          user_message: userText,
          messages: history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          session_id: "home",
        },
        (event) => {
          setEvents((current) => [...current, event]);

          if (event.event === "run.completed") {
            streamedResult = event.data as unknown as BackendRunDetail;
          }
        },
      );

      const finalResult =
        streamedResult ??
        (await runBackendFlow(selectedFlow.id, {
          user_message: userText,
          messages: history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          session_id: "home",
        }));
      setResult(finalResult);
      const finalText = stringifyRunOutput(finalResult.output);
      if (finalText) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId && !item.content
              ? { ...item, content: finalText }
              : item,
          ),
        );
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "运行数字人失败");
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
          <div className="home-console-brand">
            <img src="/icon.svg" alt="Agent Studio" className="home-console-brand-icon" />
            <span>Agent Console</span>
          </div>
          <h1>{selectedFlow?.name ?? "选择一个数字人"}</h1>
          <p>
            {isRunning ? "正在流式执行..." : selectedFlowPreset.intro}
          </p>
        </div>
        <div className="home-flow-actions">
          <label className="home-flow-picker">
            <span>数字人</span>
            <select
              value={selectedFlow?.id ?? ""}
              disabled={flows.length === 0 || isRunning}
              onChange={(event) => switchFlow(event.target.value)}
            >
              {flows.length === 0 ? (
                <option value="">暂无已暴露数字人</option>
              ) : null}
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
              clearConversationState();
              setPrompt("");
              setSwitchNotice("已清空当前数字人的对话与运行上下文。");
            }}
          >
            清空对话
          </button>
        </div>
      </div>

      <div className="home-console-grid">
        <div className="home-chat-panel">
          <div
            ref={chatStreamRef}
            className="home-chat-stream"
            onScroll={handleChatScroll}
          >
            {switchNotice ? <div className="home-switch-notice">{switchNotice}</div> : null}
            {messages.length === 0 ? (
              <div className="home-message is-agent">
                <span>{selectedFlow?.name ?? "数字人"}</span>
                <p>
                  {selectedFlowPreset.intro}
                </p>
                <div className="home-suggestion-row">
                  {selectedFlowPreset.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="home-suggestion-chip"
                      disabled={isRunning}
                      onClick={() => {
                        void runSelectedFlow(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`home-message ${message.role === "user" ? "is-user" : "is-agent"}`}
              >
                <span>
                  {message.actorName}
                </span>
                {message.content ? (
                  message.role === "assistant" ? (
                    <div className="home-message-content">
                      {renderAssistantContent(message.content)}
                    </div>
                  ) : (
                    <div className="home-message-content">{message.content}</div>
                  )
                ) : (
                  <p>正在生成...</p>
                )}
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

        <RunConsole
          title="Run Timeline"
          isRunning={isRunning}
          events={events}
          result={result}
          showResult={false}
        />
      </div>
    </section>
  );
}
