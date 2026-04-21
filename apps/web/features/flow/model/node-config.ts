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
    color: "rgba(214, 245, 228, 0.95)",
  },
  {
    kind: "agent",
    label: "Agent",
    description: "绑定已有 Agent，执行模型、技能和知识库能力。",
    color: "rgba(224, 232, 255, 0.95)",
  },
  {
    kind: "team",
    label: "Team",
    description: "组合多个已有 Agent，表达一个可嵌套的子团队或子编排。",
    color: "rgba(219, 246, 255, 0.95)",
  },
  {
    kind: "condition",
    label: "Condition",
    description: "根据字段或分类结果进入不同分支。",
    color: "rgba(255, 242, 214, 0.95)",
  },
  {
    kind: "end",
    label: "End",
    description: "工作流的结束节点，输出最终结果。",
    color: "rgba(239, 232, 255, 0.95)",
  },
];

export const getFlowStudioNodeConfig = (kind: FlowStudioNodeKind): FlowStudioNodeConfig =>
  flowStudioNodeConfigs.find((item) => item.kind === kind) ?? flowStudioNodeConfigs[0];
