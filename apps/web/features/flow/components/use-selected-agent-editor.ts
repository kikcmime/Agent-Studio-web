"use client";

import type { Form } from "@formily/core";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { getBackendAgent, updateBackendAgent, type BackendAgent, type BackendAgentDetail } from "../model/flow-api";
import type { AgentDraft, StudioNodeData } from "./flow-studio-types";

type UseSelectedAgentEditorOptions = {
  selectedAgentId: string | undefined;
  agentForm: Form;
  emptyAgentDraft: AgentDraft;
  agentDetailToDraft: (agent: BackendAgentDetail) => AgentDraft;
  splitIds: (value: string) => string[];
  setFlowError: (value: string) => void;
  setCanvasNotice: (value: string) => void;
  setBackendAgents: Dispatch<SetStateAction<BackendAgent[]>>;
  updateSelectedNode: (patch: Partial<StudioNodeData>) => void;
};

export function useSelectedAgentEditor(options: UseSelectedAgentEditorOptions) {
  const {
    selectedAgentId,
    agentForm,
    emptyAgentDraft,
    agentDetailToDraft,
    splitIds,
    setFlowError,
    setCanvasNotice,
    setBackendAgents,
    updateSelectedNode,
  } = options;
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<BackendAgentDetail | null>(null);
  const [isAgentSaving, setIsAgentSaving] = useState(false);

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

    void loadAgentDetail();

    return () => {
      mounted = false;
    };
  }, [agentDetailToDraft, agentForm, emptyAgentDraft, selectedAgentId, setFlowError]);

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
      setBackendAgents((current) =>
        current.map((agent) => (agent.id === updated.id ? { ...agent, ...updated } : agent)),
      );
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

  return {
    isAgentSaving,
    saveSelectedAgent,
  };
}
