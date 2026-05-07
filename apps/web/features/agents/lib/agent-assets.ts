import type {
  BackendAgent,
  BackendFlow,
  BackendFlowDefinition,
  BackendFlowNode,
  BackendFlowSummary,
  BackendTeam,
} from "../../flow/model/flow-api";

export type AgentAsset = {
  id: string;
  name: string;
  description: string;
  kind: "agent" | "team";
  source: "agent" | "team" | "flow";
  status: string;
  targetId: string;
  updatedAt: string;
  group: string;
  meta: string[];
};

const STUDIO_WRAPPER_MARKER = "__studio_wrapper__";

export function splitIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinIds(value?: string[]) {
  return value && value.length > 0 ? value.join(", ") : "";
}

export function inferAssetGroup(name: string, description?: string | null) {
  const text = `${name} ${description ?? ""}`;

  if (text.includes("斗地主")) return "斗地主演示";
  if (text.includes("剪刀石头布")) return "剪刀石头布";
  if (text.toLowerCase().includes("demo")) return "Demo";
  return "未分组";
}

export function isStudioWrapperFlow(flow: BackendFlowSummary | BackendFlow) {
  return Boolean(flow.description?.includes(STUDIO_WRAPPER_MARKER));
}

export function buildWrapperDescription(
  source: AgentAsset["source"],
  targetId: string,
) {
  return `${STUDIO_WRAPPER_MARKER}:${source}:${targetId}`;
}

export function parseWrapperDescription(description?: string | null) {
  if (!description?.includes(STUDIO_WRAPPER_MARKER)) return null;
  const [, source, targetId] = description.split(":");
  if (!source || !targetId) return null;
  return { source: source as AgentAsset["source"], targetId };
}

export function createAgentWrapperDefinition(
  agent: BackendAgent,
): BackendFlowDefinition {
  return {
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 120, y: 180 },
        data: { label: "Start" },
      },
      {
        id: "agent_core",
        type: "agent",
        position: { x: 420, y: 180 },
        data: {
          label: agent.name,
          agent_binding: { agent_id: agent.id },
          input_mapping: {},
          output_mapping: {},
          max_retry: 0,
          on_fail: null,
        },
      },
      {
        id: "end",
        type: "end",
        position: { x: 720, y: 180 },
        data: { label: "End" },
      },
    ],
    edges: [
      {
        id: "edge_start_agent",
        source: "start",
        target: "agent_core",
        data: { branch: "success" },
      },
      {
        id: "edge_agent_end",
        source: "agent_core",
        target: "end",
        data: { branch: "success" },
      },
    ],
  };
}

export function createTeamWrapperDefinition(
  team: BackendTeam,
  agents: BackendAgent[],
): BackendFlowDefinition {
  const memberAgents = team.member_agent_ids.map((agentId, index) => ({
    id: agentId,
    name:
      agents.find((item) => item.id === agentId)?.name ?? `Agent ${index + 1}`,
  }));

  const agentNodes: BackendFlowDefinition["nodes"] = memberAgents.map(
    (agent, index) => ({
      id: `agent_${agent.id}`,
      type: "agent",
      position:
        team.strategy === "parallel"
          ? { x: 420, y: 120 + index * 140 }
          : { x: 420 + index * 260, y: 180 },
      data: {
        label: agent.name,
        agent_binding: { agent_id: agent.id },
        input_mapping: {},
        output_mapping: {},
        max_retry: 0,
        on_fail: null,
      },
    }),
  );

  const edges: BackendFlowDefinition["edges"] = [];

  if (team.strategy === "parallel") {
    agentNodes.forEach((node) => {
      edges.push({
        id: `edge_start_${node.id}`,
        source: "start",
        target: node.id,
        data: { branch: "success" },
      });
      edges.push({
        id: `edge_${node.id}_end`,
        source: node.id,
        target: "end",
        data: { branch: "success" },
      });
    });
  } else {
    agentNodes.forEach((node, index) => {
      if (index === 0) {
        edges.push({
          id: `edge_start_${node.id}`,
          source: "start",
          target: node.id,
          data: { branch: "success" },
        });
      } else {
        edges.push({
          id: `edge_${agentNodes[index - 1].id}_${node.id}`,
          source: agentNodes[index - 1].id,
          target: node.id,
          data: { branch: "success" },
        });
      }

      if (index === agentNodes.length - 1) {
        edges.push({
          id: `edge_${node.id}_end`,
          source: node.id,
          target: "end",
          data: { branch: "success" },
        });
      }
    });
  }

  if (agentNodes.length === 0) {
    edges.push({
      id: "edge_start_end",
      source: "start",
      target: "end",
      data: { branch: "success" },
    });
  }

  return {
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 120, y: 180 },
        data: { label: "Start" },
      },
      ...agentNodes,
      {
        id: "end",
        type: "end",
        position:
          team.strategy === "parallel"
            ? {
                x: 760,
                y: Math.max(
                  180,
                  120 + Math.max(agentNodes.length - 1, 0) * 140,
                ),
              }
            : { x: 420 + Math.max(agentNodes.length, 1) * 260, y: 180 },
        data: { label: "End" },
      },
    ],
    edges,
  };
}

export function isLegacySelfBoundTeamWrapper(flow: BackendFlow, teamId: string) {
  const teamNodes = flow.definition.nodes.filter(
    (node): node is Extract<BackendFlowNode, { type: "team" }> =>
      node.type === "team",
  );
  return teamNodes.length === 1 && teamNodes[0].data.team_id === teamId;
}
