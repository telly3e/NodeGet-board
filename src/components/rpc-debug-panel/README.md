# NodeGet RPC 调试面板

该目录用于存放 NodeGet JSON-RPC WebSocket 调试面板相关文件。

当前阶段只记录功能设计与后续拆分计划，不编写组件实现。

## 目标

构建一个类似 Chrome DevTools Network 面板的弹出式调试 modal，专门用于 NodeGet 的 JSON-RPC over WebSocket 调用调试。

核心交互：

- 网络页按“一次调用一行”展示，而不是把发送和接收拆成两行。
- 点击调用记录后，在右侧抽屉查看发送消息和接收消息。
- 详情抽屉提供“编辑并重新构造”，跳转到请求构造器并自动填入 method、params、id、鉴权来源。
- 请求构造器的 method 在输入框内提供候选提示，不维护独立模板区。
- 响应区直接展示 JSON-RPC result/error。

## 当前 Figma 页面

Figma 文件：

https://www.figma.com/design/x5Oj7veRGkWFTD81F8DYwu

页面结构：

1. 网络消息流
2. 请求构造器
3. 实时订阅
4. 鉴权与环境
5. 设置

## 文档

- [功能分析](./feature-analysis.md)
- [后续文件拆分建议](./structure-plan.md)
