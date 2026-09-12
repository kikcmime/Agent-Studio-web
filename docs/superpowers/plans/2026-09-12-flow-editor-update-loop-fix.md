# Flow Editor Update Loop Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复点击数字人「编排」后 React Flow 因不稳定 effect 依赖而触发的无限更新。

**Architecture:** 保持现有图编辑器结构，只稳定跨 hook 传递的操作函数引用，并把依赖整个 props 对象的 effect 改成精确依赖。用轻量 Node 回归测试锁定导致循环的源码约束，再通过类型检查、构建和浏览器操作验证真实页面。

**Tech Stack:** Next.js 15、React 19、TypeScript、React Flow、Node test runner

---

### Task 1: 锁定无限更新回归

**Files:**
- Create: `apps/web/features/flow/components/flow-editor-stability.test.mjs`
- Modify: `apps/web/features/flow/components/use-flow-run-state.ts`
- Modify: `apps/web/features/flow/components/use-flow-graph-editor.ts`
- Modify: `apps/web/features/flow/components/flow-canvas.tsx`

- [ ] **Step 1: Write the failing test**

创建 Node 源码约束测试：断言 `resetRunState`、`runCurrentFlow` 以及传给 React Flow 的图编辑操作使用 `useCallback`；断言节点选择器 effect 不再依赖整个 `props` 对象。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/features/flow/components/flow-editor-stability.test.mjs`

Expected: FAIL，指出 `resetRunState` 仍是普通箭头函数，或 effect 仍使用 `[props]`。

- [ ] **Step 3: Write minimal implementation**

在 `use-flow-run-state.ts` 引入 `useCallback`，稳定 `resetRunState` 与 `runCurrentFlow`；在 `use-flow-graph-editor.ts` 用 `useCallback` 包裹 `updateSelectedNode`、`onConnect`、`addNode`、`openNodeSelectorFromNode`、`deleteNodeById`、`deleteSelectedNode`；在 `flow-canvas.tsx` 解构选择器参数并使用 `[anchor, onClose]` 精确依赖。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/features/flow/components/flow-editor-stability.test.mjs`

Expected: PASS，全部稳定性约束通过。

- [ ] **Step 5: Run project verification**

Run: `pnpm typecheck`

Expected: 所有 TypeScript 项目通过且无 `any`。

Run: `pnpm build`

Expected: Next.js production build 成功。

- [ ] **Step 6: Verify in browser**

打开 `http://127.0.0.1:4000`，进入数字人页并点击任意卡片的「编排」。确认画布成功显示、可以操作，控制台中不再出现 `Maximum update depth exceeded` 或 React Flow nodeTypes/edgeTypes 重建警告。

- [ ] **Step 7: Commit**

```bash
git add apps/web/features/flow/components/flow-editor-stability.test.mjs apps/web/features/flow/components/use-flow-run-state.ts apps/web/features/flow/components/use-flow-graph-editor.ts apps/web/features/flow/components/flow-canvas.tsx
git commit -m "fix: 修复流程编排无限更新"
```
