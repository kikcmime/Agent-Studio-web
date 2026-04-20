# Agent Studio Frontend 实现文档

## 1. 技术目标

前端采用以下方向：

- Next.js：承载应用壳、页面路由和服务端基础能力
- Tailwind CSS：负责样式体系
- Monorepo：承载 web、shared types、ui 基础包
- React Flow：承载 Flow 画布

前端第一版目标不是做花哨交互，而是先把“复杂对象的编辑体验”做稳定。

## 2. 前端职责

前端只负责 4 件事：

- 展示和编辑 Flow
- 展示和编辑 Agent
- 发起 Run 并查看结果
- 管理最小资源配置关系

不要在前端内嵌执行逻辑，不要把业务判断散落在组件里。

## 3. 建议目录

```txt
Agent-Studio-web/
  apps/
    web/
      app/
      features/
        flow/
        agent/
        run/
        resource/
      components/
      lib/
  packages/
    ui/
    shared/
    config/
```

如果暂时不搭完整 monorepo，也建议先按这个边界组织目录。

## 4. 页面设计

### 4.1 Flow 列表页

展示 Flow 名称、更新时间、版本、状态。

操作只保留：

- 新建
- 编辑
- 运行
- 查看最近一次 Run

### 4.2 Flow 画布页

这是第一版核心页面。

页面结构建议固定为三栏：

- 左侧：节点面板
- 中间：React Flow 画布
- 右侧：节点配置 / Flow 配置面板

必须支持的节点类型：

- Start
- Agent
- Condition
- End

### 4.3 Agent 列表页

用于展示已有 Agent，并支持新建和编辑。

### 4.4 Agent 配置页

一个 Agent 配置页先只保留 6 个区域：

- 基础信息
- System Prompt
- 模型配置
- Skill 绑定
- MCP 绑定
- 知识库绑定

### 4.5 Run 详情页

展示一次执行的完整轨迹：

- Flow 运行状态
- 节点执行顺序
- 每个节点的输入和输出
- 错误信息
- 耗时

## 5. 前端核心数据模型

前端内部至少统一维护以下视图模型：

```ts
type FlowEditorState = {
  flowId: string
  version: number
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedNodeId?: string
  dirty: boolean
}

type FlowNode =
  | StartNode
  | AgentNode
  | ConditionNode
  | EndNode

type AgentBinding = {
  agentId: string
  agentVersion?: number
}
```

重点不是类型写得多复杂，而是：

- 画布节点模型和服务端 DTO 分层
- 页面状态和保存数据分层
- 表单状态和运行态分层

## 6. 组件边界

组件尽量分成三层：

### 6.1 页面容器

负责数据加载、路由和保存动作。

### 6.2 业务组件

例如：

- FlowCanvas
- NodeConfigPanel
- AgentForm
- RunTimeline

### 6.3 纯展示组件

例如按钮、表单项、状态标签、日志块。

这样做的目的是后面替换 UI 样式时，不影响业务模型。

## 7. 状态管理原则

第一版不强求引入重型状态库，但要遵守以下原则：

- 服务端数据和本地编辑态分开
- React Flow 内部状态和业务状态分开
- 不在深层组件直接拼接请求参数

建议把每个领域的逻辑放在 `features/*` 下，页面只做组装。

## 8. 交互范围控制

第一版只做必要交互：

- 拖拽新增节点
- 连线
- 删除节点
- 右侧编辑配置
- 保存
- 运行

先不要做：

- 复制粘贴节点
- 多选批量操作
- 历史回退
- 实时协同

## 9. API 对接原则

前端请求层需要遵守：

- 所有接口响应统一 envelope
- 节点类型使用稳定枚举值
- 资源绑定统一走 id 引用
- 前端不要依赖后端隐式字段

建议共享一份最小类型定义给前后端使用，但不要过早追求全量代码生成。

## 10. 可迭代性要求

为了后续扩展，前端需要预留 3 个能力：

- 节点类型可扩展：新增节点不需要重写整个画布
- 右侧配置面板可扩展：不同节点走 schema 化配置
- Run 展示可扩展：后面可加入流式日志和中间事件

## 11. 当前脚手架映射

目前前端仓库已经先落了最小骨架，后续代码请尽量沿着这套结构继续：

```txt
Agent-Studio-web/
  apps/
    web/
      app/
        layout.tsx
        page.tsx
        globals.css
      features/
        flow/
          model/
            initial-flow.ts
  packages/
    shared/
      src/
        studio-types.ts
```

这套骨架的职责是：

- `app/`：应用入口和页面壳
- `features/flow/`：Flow 领域的前端模型和画布逻辑
- `packages/shared/`：前后端共享的最小对象类型

第一版请不要把领域类型重新散落到页面里，优先从 `packages/shared` 引用。

## 12. 第一阶段开发顺序

前端建议按这个顺序推进：

1. 先补 Flow 列表页和 Agent 列表页的静态页面骨架
2. 再接 Flow 画布页，先把 React Flow 节点和右侧配置栏打通
3. 然后接 Agent 配置页，完成资源绑定表单
4. 最后做 Run 详情页和时间线展示

顺序不要倒过来。
先把可编辑对象建模好，再补复杂交互。

## 13. UI 与数据边界补充

前端在实现时，建议强制区分 3 层对象：

- API DTO：直接和接口通信的结构
- Shared Types：前后端都认可的稳定对象
- UI View Model：只服务当前页面交互的对象

这三层允许相互映射，但不要直接混用。

如果后面要支持草稿、自动保存、版本对比，这个分层会非常关键。

## 14. 第一版完成标准

前端第一版完成，以这几个结果为准：

- 可以创建并保存 Flow
- 可以拖拽和配置 4 类节点
- 可以创建 Agent 并绑定资源
- 可以发起一次 Run
- 可以查看 Run 详情

只要这几个动作是稳定的，前端第一版就成立。
