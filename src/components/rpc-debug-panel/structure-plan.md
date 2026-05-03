# RPC 调试面板结构规划

当前目录已经从“线框说明”进入可运行实现阶段。组件按页面职责拆分，顶层只负责事件注册生命周期、页签切换和整体外壳。

```text
src/components/rpc-debug-panel/
  README.md
  feature-analysis.md
  structure-plan.md
  RpcDebugPanel.vue
  rpcDebugStore.ts
  websocketPatch.ts
  types.ts
  helpers.ts
  components/
    RpcNetworkView.vue
    RpcNetworkDrawer.vue
    RpcComposerView.vue
    RpcStreamsView.vue
    RpcAuthView.vue
    RpcSettingsView.vue
```

## 文件职责

`RpcDebugPanel.vue`

- 注册和注销 WebSocket patch 事件处理器。
- 维护当前页签。
- 渲染顶栏、页签和各子页面。
- 不直接处理网络列表、构造器、订阅或鉴权细节。

`websocketPatch.ts`

- 只负责 patch `window.WebSocket`。
- 在 `main.ts` 尽可能靠前安装，接管之后新建的 WebSocket。
- 不解析 JSON-RPC，不持有面板状态。
- 对外提供事件监听注册函数，注册后返回注销函数。

`rpcDebugStore.ts`

- 注册 `websocketPatch.ts` 派发的连接和帧事件。
- 解析 JSON-RPC request / response / notification。
- 按 `connectionId + id` 配对请求响应。
- 维护记录列表、连接列表、设置和选中记录。

`helpers.ts`

- 方法候选、方法提示。
- 状态/类型中文展示。
- 时间格式化、后端 key、下载文件等纯工具。

`components/RpcNetworkView.vue`

- 网络消息流列表。
- 暂停、清空、导出、筛选。
- 点击记录后打开右侧详情抽屉。

`components/RpcNetworkDrawer.vue`

- 展示选中记录的发送消息、接收消息、状态和耗时。
- 支持复制完整记录、复制请求/响应。
- 支持“编辑并重新构造”，通过事件把记录传给构造器页。

`components/RpcComposerView.vue`

- 方法输入和候选提示。
- 鉴权来源、参数 JSON。
- 使用现有 `getWsConnection().call()` 发送测试请求。
- 请求 ID 由现有连接层自动生成。
- 右侧展示 `result` 或错误文本。

`components/RpcStreamsView.vue`

- 使用现有 `useLogs()` 订阅日志推送。
- 展示当前 subscription id。
- 展示实时推送日志。
- 不在组件内手写 JSON-RPC WebSocket 协议。

`components/RpcAuthView.vue`

- 展示 `useBackendStore.backends` 中保存的完整后端凭证。
- 展示当前 token 信息和 `permissionStore.rules` 权限明细。
- 不使用 `token_list_all_tokens` 作为可发送 token 来源，因为该接口不返回 secret/password。

`components/RpcSettingsView.vue`

- 调试面板本地设置。
- 包含最大保留消息数、token 脱敏、notification 捕获、原始 WS 帧捕获、JSON 格式化、导出/清空。

## 数据流

- `main.ts` 启动时安装 WebSocket patch。
- 页面挂载时向 patch 注册事件处理器；卸载时注销事件处理器。
- 注册期间捕获到的 JSON-RPC 消息进入 `rpcDebugStore.records`。
- 非 JSON-RPC 帧默认不记录；设置中打开“捕获原始 WS 帧”后才记录。
- 请求构造器使用项目现有 `useWsConnection.ts` 调用方式，因此自身请求也会经过已 patch 的 WebSocket 并进入网络页。
- 日志订阅使用项目现有 `useLogs.ts`，同样会被 WebSocket patch 捕获。

## 实现边界

- 这是前端运行时捕获，不是 Chrome DevTools 协议级捕获。
- 只能捕获 patch 安装之后创建的 WebSocket；只有面板注册处理器期间才会进入面板记录。
- 当前只实现 WebSocket patch，不 patch `fetch` / `XMLHttpRequest`。
- `/terminal` 这类非 JSON-RPC WebSocket 默认不会进入 RPC 表格，避免终端流量污染列表。
