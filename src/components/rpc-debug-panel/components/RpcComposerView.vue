<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Copy, Send } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  formatDebugPayload,
  maskToken,
  type RpcDebugRecord,
  useRpcDebugStore,
} from "../rpcDebugStore";
import { backendKey, methodCatalog, methodHints } from "../helpers";
import type { ComposerDraft } from "../types";

const props = defineProps<{
  pendingRecord?: RpcDebugRecord | null;
}>();

const emit = defineEmits<{
  copied: [message?: string];
  consumedRecord: [];
}>();

const debugStore = useRpcDebugStore();
const backendStore = useBackendStore();
const methodFocused = ref(false);

const backendOptions = computed(() => backendStore.backends.value);
const currentBackendKey = computed(() =>
  backendStore.currentBackend.value
    ? backendKey(backendStore.currentBackend.value)
    : "",
);

const composer = reactive<ComposerDraft>({
  method: "nodeget-server_hello",
  requestId: "",
  backendKey: "",
  paramsText: "[]",
  sending: false,
  responseText: "尚未发送请求",
  responseMeta: "等待发送",
});

const selectedBackend = computed(() =>
  backendOptions.value.find((item) => backendKey(item) === composer.backendKey),
);

const filteredMethodSuggestions = computed(() => {
  const q = composer.method.trim().toLowerCase();
  return methodCatalog
    .filter((method) => !q || method.toLowerCase().includes(q))
    .slice(0, 6);
});

watch(
  currentBackendKey,
  (key) => {
    if (!composer.backendKey) composer.backendKey = key;
  },
  { immediate: true },
);

watch(
  () => props.pendingRecord,
  (record) => {
    if (!record) return;
    const req =
      record.request && typeof record.request === "object"
        ? (record.request as { method?: unknown; params?: unknown })
        : null;
    composer.method =
      typeof req?.method === "string" ? req.method : record.method;
    composer.requestId = "";
    composer.paramsText = formatDebugPayload(req?.params ?? {});
    emit("consumedRecord");
  },
  { immediate: true },
);

const copyText = async (text: string, message?: string) => {
  await navigator.clipboard.writeText(text);
  emit("copied", message);
};

const delayHideMethodSuggestions = () => {
  window.setTimeout(() => {
    methodFocused.value = false;
  }, 140);
};

const selectMethodSuggestion = (method: string) => {
  composer.method = method;
  methodFocused.value = false;
  fillDefaultParams();
};

const fillDefaultParams = () => {
  const token = selectedBackend.value?.token ?? "";
  const method = composer.method.trim();
  if (
    [
      "nodeget-server_hello",
      "nodeget-server_version",
      "nodeget-server_uuid",
    ].includes(method)
  ) {
    composer.paramsText = "[]";
    return;
  }
  if (method === "nodeget-server_stream_log") {
    composer.paramsText = JSON.stringify(
      { token, log_filter: "info,rpc=debug" },
      null,
      2,
    );
    return;
  }
  composer.paramsText = JSON.stringify({ token }, null, 2);
};

const parseComposerParams = () => {
  const text = composer.paramsText.trim();
  if (!text) return [];
  return JSON.parse(text) as unknown;
};

const sendComposerRequest = async () => {
  const backend = selectedBackend.value;
  if (!backend?.url) {
    toast.error("请选择后端凭据");
    return;
  }
  composer.sending = true;
  composer.responseMeta = "发送中";
  const startedAt = performance.now();
  try {
    const result = await getWsConnection(backend.url).call<unknown>(
      composer.method.trim(),
      parseComposerParams(),
      10000,
      {
        idPrefix: "debug-",
        onRequestId: (id) => {
          composer.requestId = id;
        },
      },
    );
    const duration = Math.round(performance.now() - startedAt);
    composer.responseMeta = `成功 · ${duration}ms`;
    composer.responseText =
      typeof result === "string"
        ? result
        : JSON.stringify(
            result ?? null,
            null,
            debugStore.settings.formatJson ? 2 : 0,
          );
  } catch (error) {
    composer.responseMeta = "错误";
    composer.responseText =
      error instanceof Error ? error.message : String(error);
  } finally {
    composer.sending = false;
  }
};
</script>

<template>
  <div class="grid min-h-[620px] gap-6 p-6 lg:grid-cols-[520px_minmax(0,1fr)]">
    <section class="rounded-lg border p-5">
      <div
        class="mb-5 rounded-md border bg-muted/35 px-4 py-3 text-sm text-muted-foreground"
      >
        从网络详情点击“编辑并重新构造”会自动带入方法和参数。
      </div>
      <div class="space-y-5">
        <label class="relative grid gap-1.5">
          <span class="text-xs font-medium text-muted-foreground">方法</span>
          <input
            v-model="composer.method"
            class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            placeholder="nodeget-server_hello"
            @focus="methodFocused = true"
            @blur="delayHideMethodSuggestions"
          />
          <div
            v-if="methodFocused"
            class="absolute left-0 right-0 top-[68px] z-10 overflow-hidden rounded-md border bg-popover shadow-lg"
          >
            <button
              v-for="method in filteredMethodSuggestions"
              :key="method"
              type="button"
              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              @mousedown.prevent="selectMethodSuggestion(method)"
            >
              <span class="font-mono text-xs">{{ method }}</span>
              <span class="text-xs text-muted-foreground">{{
                methodHints[method] ?? "RPC"
              }}</span>
            </button>
          </div>
        </label>

        <div class="grid grid-cols-2 gap-4">
          <label class="grid gap-1.5">
            <span class="text-xs font-medium text-muted-foreground"
              >请求 ID</span
            >
            <input
              v-model="composer.requestId"
              class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              disabled
              placeholder="debug-<random_id>"
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-medium text-muted-foreground"
              >鉴权来源</span
            >
            <select
              v-model="composer.backendKey"
              class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              @change="fillDefaultParams"
            >
              <option value="">未选择</option>
              <option
                v-for="backend in backendOptions"
                :key="backendKey(backend)"
                :value="backendKey(backend)"
              >
                {{ backend.name }} / {{ maskToken(backend.token) }}
              </option>
            </select>
          </label>
        </div>

        <label class="grid gap-1.5">
          <span class="text-xs font-medium text-muted-foreground"
            >参数 JSON</span
          >
          <textarea
            v-model="composer.paramsText"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 min-h-[180px] font-mono"
          />
        </label>

        <div class="flex gap-2">
          <button
            class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-50"
            type="button"
            :disabled="composer.sending"
            @click="sendComposerRequest"
          >
            <Send class="size-4" />
            {{ composer.sending ? "发送中" : "发送" }}
          </button>
          <button
            class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            type="button"
            @click="copyText(composer.paramsText, '参数 JSON 已复制')"
          >
            <Copy class="size-4" />
            复制 JSON
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-lg border p-5">
      <div class="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold">响应结果</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ composer.responseMeta }}
          </p>
        </div>
        <button
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="copyText(composer.responseText, '响应结果已复制')"
        >
          <Copy class="size-4" />
          复制结果
        </button>
      </div>
      <textarea
        :value="composer.responseText"
        readonly
        class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 min-h-[360px] resize-none font-mono"
      />
    </section>
  </div>
</template>
