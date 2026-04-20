import type { FlowDefinition } from "@agent-studio/shared";

export const initialFlowDefinition: FlowDefinition = {
  nodes: [
    {
      id: "node_start",
      type: "start",
      position: { x: 120, y: 180 },
      data: { label: "Start" },
    },
    {
      id: "node_agent_1",
      type: "agent",
      position: { x: 360, y: 180 },
      data: {
        label: "Triage Agent",
        agentBinding: {
          agentId: "agent_demo",
        },
        inputMapping: {},
        outputMapping: {},
      },
    },
    {
      id: "node_end",
      type: "end",
      position: { x: 620, y: 180 },
      data: { label: "End" },
    },
  ],
  edges: [
    {
      id: "edge_demo_01",
      source: "node_start",
      target: "node_agent_1",
    },
    {
      id: "edge_demo_02",
      source: "node_agent_1",
      target: "node_end",
    },
  ],
};
