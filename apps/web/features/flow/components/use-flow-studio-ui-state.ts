"use client";

import { useCallback, useEffect, useState } from "react";

export function useFlowStudioUiState() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFlowSettingsOpen, setIsFlowSettingsOpen] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [centerSignal, setCenterSignal] = useState(0);
  const [canvasNotice, setCanvasNotice] = useState("");
  const [nodeSelectorAnchor, setNodeSelectorAnchor] = useState<{
    sourceNodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [previewTeamNodeId, setPreviewTeamNodeId] = useState<string | null>(null);

  const toggleTeamMembers = useCallback((nodeId: string) => {
    setPreviewTeamNodeId((current) => (current === nodeId ? null : nodeId));
  }, []);

  useEffect(() => {
    const centerOnNormalWindow = () => setCenterSignal((value) => value + 1);

    window.addEventListener("agent-studio:center-flow", centerOnNormalWindow);
    return () => window.removeEventListener("agent-studio:center-flow", centerOnNormalWindow);
  }, []);

  useEffect(() => {
    if (!canvasNotice) {
      return;
    }

    const timer = window.setTimeout(() => setCanvasNotice(""), 1600);
    return () => window.clearTimeout(timer);
  }, [canvasNotice]);

  return {
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
  };
}
