import type { Backend } from "@/composables/useBackendStore";
import type { RpcDebugRecord } from "./rpcDebugStore";
import type { RpcDebugTab } from "./types";

export const rpcDebugTabs: RpcDebugTab[] = [
  { key: "network", label: "网络" },
  { key: "composer", label: "构造器" },
  { key: "subscription", label: "订阅" },
  { key: "auth", label: "鉴权" },
  { key: "settings", label: "设置" },
];

export const methodCatalog = [
  "nodeget-server_hello",
  "nodeget-server_version",
  "nodeget-server_uuid",
  "nodeget-server_list_all_agent_uuid",
  "nodeget-server_read_config",
  "nodeget-server_edit_config",
  "nodeget-server_database_storage",
  "nodeget-server_log",
  "nodeget-server_stream_log",
  "token_get",
  "token_list_all_tokens",
  "kv_get_value",
  "kv_set_value",
  "task_create_task",
  "task_query",
  "agent_query_static",
  "agent_query_dynamic_summary",
];

export const methodHints: Record<string, string> = {
  "nodeget-server_hello": "无鉴权",
  "nodeget-server_read_config": "SuperToken",
  "nodeget-server_stream_log": "订阅",
  token_get: "Token",
  token_list_all_tokens: "SuperToken",
  task_query: "Task",
};

export const backendKey = (backend: Backend) =>
  `${backend.url}::${backend.token}`;

export const statusClass = (status: string) => {
  if (status === "success" || status === "streaming") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "error" || status === "closed") {
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300";
  }
  if (status === "pending") {
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "bg-muted text-muted-foreground ring-border";
};

export const kindText = (record: RpcDebugRecord) => {
  const map: Record<string, string> = {
    call: "调用",
    subscription: "订阅",
    notification: "推送",
    batch: "批量",
    raw: "原始",
  };
  return map[record.kind] ?? record.kind;
};

export const statusText = (record: RpcDebugRecord) => {
  const map: Record<string, string> = {
    pending: "等待中",
    success: "成功",
    error: "错误",
    streaming: "推送中",
    closed: "已关闭",
    raw: "原始",
  };
  return map[record.status] ?? record.status;
};

export const timeText = (timestamp: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);

export const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
