export type FlowStudioNodeKind = "start" | "agent" | "team" | "condition" | "end";

export type FlowStudioNodeConfig = {
  kind: FlowStudioNodeKind;
  label: string;
  description: string;
  color: string;
};

export const flowStudioNodeConfigs: FlowStudioNodeConfig[] = [
  {
    kind: "start",
    label: "Start",
    description: "工作流的起点，接收初始输入。",
    color: "#b9eccf",
  },
  {
    kind: "agent",
    label: "Agent",
    description: "绑定已有 Agent，执行模型、技能和知识库能力。",
    color: "#c5d2ff",
  },
  {
    kind: "team",
    label: "Team",
    description: "组合多个已有 Agent，表达一个可嵌套的子团队或子编排。",
    color: "#bfeeff",
  },
  {
    kind: "condition",
    label: "Condition",
    description: "根据字段或分类结果进入不同分支。",
    color: "#ffe4ae",
  },
  {
    kind: "end",
    label: "End",
    description: "工作流的结束节点，输出最终结果。",
    color: "#dfd2ff",
  },
];

export const getFlowStudioNodeConfig = (kind: FlowStudioNodeKind): FlowStudioNodeConfig =>
  flowStudioNodeConfigs.find((item) => item.kind === kind) ?? flowStudioNodeConfigs[0];
