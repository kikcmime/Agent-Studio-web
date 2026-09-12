"use client";

import { useCallback, useState } from "react";

import { runBackendFlow, streamBackendFlowRun, type BackendRunDetail, type BackendRunStreamEvent } from "../model/flow-api";

export function useFlowRunState(
  selectedFlowId: string | undefined,
  setFlowError: (value: string) => void,
  setCanvasNotice: (value: string) => void,
) {
  const [runResult, setRunResult] = useState<BackendRunDetail | null>(null);
  const [runEvents, setRunEvents] = useState<BackendRunStreamEvent[]>([]);
  const [isRunStreaming, setIsRunStreaming] = useState(false);
  const [runInputText] = useState('{"user_message":"帮我处理这个问题"}');

  const resetRunState = useCallback(() => {
    setRunResult(null);
    setRunEvents([]);
  }, []);

  const runCurrentFlow = useCallback(async () => {
    if (!selectedFlowId) {
      return;
    }

    resetRunState();
    setFlowError("");
    setIsRunStreaming(true);

    try {
      const input = JSON.parse(runInputText) as Record<string, unknown>;
      let streamedResult: BackendRunDetail | null = null;

      await streamBackendFlowRun(selectedFlowId, input, (event) => {
        setRunEvents((current) => [...current, event]);

        if (event.event === "run.completed") {
          streamedResult = event.data as BackendRunDetail;
        }
      });

      const result = streamedResult ?? (await runBackendFlow(selectedFlowId, input));
      setRunResult(result);
      setCanvasNotice(`运行完成：${result.status}`);
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "运行调试失败");
    } finally {
      setIsRunStreaming(false);
    }
  }, [resetRunState, runInputText, selectedFlowId, setCanvasNotice, setFlowError]);

  return {
    runResult,
    runEvents,
    isRunStreaming,
    resetRunState,
    runCurrentFlow,
  };
}
