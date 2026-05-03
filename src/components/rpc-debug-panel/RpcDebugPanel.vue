<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import { useBackendStore } from "@/composables/useBackendStore";
import {
  registerRpcDebugEventHandler,
  type RpcDebugRecord,
  useRpcDebugStore,
} from "./rpcDebugStore";
import { rpcDebugTabs } from "./helpers";
import type { RpcDebugTabKey } from "./types";
import RpcAuthView from "./components/RpcAuthView.vue";
import RpcComposerView from "./components/RpcComposerView.vue";
import RpcNetworkView from "./components/RpcNetworkView.vue";
import RpcSettingsView from "./components/RpcSettingsView.vue";
import RpcStreamsView from "./components/RpcStreamsView.vue";

const activeTab = ref<RpcDebugTabKey>("network");
const pendingComposerRecord = ref<RpcDebugRecord | null>(null);

const debugStore = useRpcDebugStore();
const backendStore = useBackendStore();

let unregisterDebugEvents: (() => void) | undefined;

onMounted(() => {
  unregisterDebugEvents = registerRpcDebugEventHandler();
});

onBeforeUnmount(() => {
  unregisterDebugEvents?.();
});

const connectionLabel = computed(() => {
  const backend = backendStore.currentBackend.value;
  return backend?.url || "未选择后端";
});

const latencyLabel = computed(() => {
  const latest = [...debugStore.records.value]
    .reverse()
    .find((record) => typeof record.durationMs === "number");
  return latest?.durationMs != null ? `${latest.durationMs}ms` : "--";
});

const copyText = async (text: string, message = "已复制") => {
  await navigator.clipboard.writeText(text);
  toast.success(message);
};

const handleRecordEdit = (record: RpcDebugRecord) => {
  pendingComposerRecord.value = record;
  activeTab.value = "composer";
};
</script>

<template>
  <section>
    <div class="overflow-hidden rounded-lg border bg-background shadow-sm">
      <header class="flex h-16 items-center gap-3 border-b px-6">
        <div class="text-base font-semibold">NodeGet RPC 调试</div>
        <span
          class="inline-flex h-7 items-center rounded-md px-3 text-xs font-medium ring-1"
          :class="
            debugStore.activeConnectionCount.value > 0
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground ring-border'
          "
        >
          WS
          {{ debugStore.activeConnectionCount.value > 0 ? "已连接" : "待连接" }}
        </span>
        <span
          class="inline-flex h-7 items-center rounded-md bg-muted px-3 text-xs ring-1 ring-border"
        >
          {{ latencyLabel }}
        </span>
        <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ connectionLabel }}
        </span>
      </header>

      <nav class="flex h-13 items-center gap-2 border-b px-6">
        <button
          v-for="tab in rpcDebugTabs"
          :key="tab.key"
          type="button"
          class="h-9 rounded-md px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          :class="
            activeTab === tab.key
              ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              : ''
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <RpcNetworkView
        v-if="activeTab === 'network'"
        @copy="copyText"
        @edit-record="handleRecordEdit"
      />
      <RpcComposerView
        v-else-if="activeTab === 'composer'"
        :pending-record="pendingComposerRecord"
        @copied="(message) => toast.success(message || '已复制')"
        @consumed-record="pendingComposerRecord = null"
      />
      <RpcStreamsView v-else-if="activeTab === 'subscription'" />
      <RpcAuthView v-else-if="activeTab === 'auth'" @copy="copyText" />
      <RpcSettingsView v-else />
    </div>
  </section>
</template>
