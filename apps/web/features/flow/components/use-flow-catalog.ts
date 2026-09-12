"use client";

import { useEffect, useState } from "react";
import type { Edge, Node } from "@xyflow/react";

import { getBackendFlow, listBackendAgents, listBackendFlows, listBackendTeams, updateBackendFlow, type BackendAgent, type BackendFlowDefinition, type BackendFlowSummary, type BackendTeam } from "../model/flow-api";
import { readQueryParam, replaceRouteQuery } from "../../workspace/lib/router-state";
import type { FlowRecord, StudioNodeData } from "./flow-studio-types";

type UseFlowCatalogOptions = {
  backendFlowToRecord: (flow: Awaited<ReturnType<typeof getBackendFlow>>) => FlowRecord;
  nodesToBackendDefinition: (nodes: Node<StudioNodeData>[], edges: Edge[]) => BackendFlowDefinition;
  setFlowError: (value: string) => void;
  setCanvasNotice: (value: string) => void;
};

export function useFlowCatalog(options: UseFlowCatalogOptions) {
  const { backendFlowToRecord, nodesToBackendDefinition, setFlowError, setCanvasNotice } = options;
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(() => readQueryParam("flow") ?? "");
  const [backendAgents, setBackendAgents] = useState<BackendAgent[]>([]);
  const [backendTeams, setBackendTeams] = useState<BackendTeam[]>([]);
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const [isFlowSaving, setIsFlowSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadBackendSeed() {
      setIsFlowLoading(true);
      setFlowError("");

      try {
        const [backendFlows, agents, teams] = await Promise.all([
          listBackendFlows(),
          listBackendAgents(),
          listBackendTeams(),
        ]);

        if (!mounted) {
          return;
        }

        const backendFlowDetails = await Promise.all(
          backendFlows.map(async (flow: BackendFlowSummary) => getBackendFlow(flow.id)),
        );
        const records = backendFlowDetails.map(backendFlowToRecord);
        const routeFlowId = readQueryParam("flow");
        const routeFlow = routeFlowId ? records.find((flow) => flow.id === routeFlowId) : undefined;

        setFlows(records);
        setSelectedFlowId(routeFlow?.id ?? "");
        setBackendAgents(agents);
        setBackendTeams(teams);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setFlows([]);
        setSelectedFlowId("");
        setBackendAgents([]);
        setBackendTeams([]);
        setFlowError(
          error instanceof Error ? error.message : "本地后端暂不可用，请确认 7100 端口服务已启动。",
        );
      } finally {
        if (mounted) {
          setIsFlowLoading(false);
        }
      }
    }

    void loadBackendSeed();

    return () => {
      mounted = false;
    };
  }, [backendFlowToRecord, setFlowError]);

  useEffect(() => {
    replaceRouteQuery({
      app: "flow",
      flow: selectedFlowId || null,
    });
  }, [selectedFlowId]);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0];

  const updateSelectedFlow = (patch: Partial<Pick<FlowRecord, "name" | "description" | "flowType">>) => {
    if (!selectedFlow) {
      return;
    }

    setFlows((current) => current.map((flow) => (flow.id === selectedFlow.id ? { ...flow, ...patch } : flow)));
  };

  const saveCurrentFlow = async (nodes: Node<StudioNodeData>[], edges: Edge[]) => {
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
      setFlowError(
        error instanceof Error ? error.message : "保存 Flow 失败，请确认后端 7100 正常运行。",
      );
    } finally {
      setIsFlowSaving(false);
    }
  };

  return {
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
  };
}
