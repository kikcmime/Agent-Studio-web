# Agent-Studio-web

Agent Studio 前端仓库。

这个仓库承载 Agent Studio 的可视化工作台，目标是支持：

- Flow 画布编排
- Agent 配置与资源绑定
- Run 轨迹查看
- 后续扩展为多 Agent 工作流编辑器

第一版先收敛成一个开发者向的 Agent Studio 基础版，不追求一次做成完整 Dify 替代品。

## 当前定位

这个前端项目主要负责：

- 展示 Flow 列表和 Flow 编辑器
- 展示 Agent 列表和 Agent 配置页
- 发起 Run 并查看运行结果
- 管理 Skill、MCP、知识库等资源绑定关系

## 技术栈

- Next.js
- TypeScript
- pnpm workspace
- Tailwind CSS
- React Flow

## 当前结构

```txt
Agent-Studio-web/
  apps/
    web/
      app/
      features/
        flow/
  packages/
    shared/
      src/
        studio-types.ts
  docs/
    frontend/
    product/
```

## 当前已有内容

- `apps/web/app/page.tsx`
  当前首页骨架

- `apps/web/features/flow/model/initial-flow.ts`
  第一版 Flow 初始模型

- `packages/shared/src/studio-types.ts`
  前端共享业务类型

- `docs/product/product-definition.md`
  产品定义文档

- `docs/frontend/frontend-implementation.md`
  前端实现文档

## 安装与运行

```bash
cd /Users/wtf/Desktop/agent-studio/Agent-Studio-web
pnpm install
pnpm dev
```

如果本机没有 `pnpm`，先执行：

```bash
npm install -g pnpm
```

## 第一版要做的东西

这个仓库接下来优先做：

1. Flow 列表页
2. Flow 画布页
3. Agent 列表页
4. Agent 配置页
5. Run 详情页

## 文档

- `docs/product/product-definition.md`
- `docs/frontend/frontend-implementation.md`
