<script setup lang="ts">
import { computed } from "vue";
import { Copy, X } from "lucide-vue-next";
import type { RpcDebugRecord } from "../rpcDebugStore";
import { formatDebugPayload } from "../rpcDebugStore";
import { statusClass, statusText } from "../helpers";

const props = defineProps<{
  record: RpcDebugRecord;
}>();

const emit = defineEmits<{
  close: [];
  copy: [text: string, message?: string];
  edit: [record: RpcDebugRecord];
}>();

const requestText = computed(() =>
  formatDebugPayload(props.record.request, props.record.method),
);

const responseText = computed(() =>
  formatDebugPayload(props.record.response, props.record.method),
);
</script>

<template>
  <aside
    class="absolute bottom-0 right-0 top-0 flex w-[380px] flex-col border-l bg-background shadow-xl"
  >
    <div class="border-b px-5 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">消息详情</h2>
          <p class="mt-1 max-w-[250px] truncate text-xs text-muted-foreground">
            {{ record.method }}
          </p>
        </div>
        <button
          class="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <div class="space-y-4 overflow-auto p-5">
      <div class="flex flex-wrap gap-2">
        <span
          class="inline-flex h-7 items-center rounded-md px-3 text-xs ring-1"
          :class="statusClass(record.status)"
        >
          {{ statusText(record) }}
        </span>
        <span
          class="inline-flex h-7 items-center rounded-md bg-muted px-3 text-xs ring-1 ring-border"
        >
          {{ record.durationMs != null ? `${record.durationMs}ms` : "-" }}
        </span>
        <span
          class="inline-flex h-7 items-center rounded-md bg-muted px-3 text-xs ring-1 ring-border"
        >
          {{ record.direction }}
        </span>
      </div>

      <div class="flex gap-2">
        <button
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="emit('edit', record)"
        >
          编辑并重新构造
        </button>
        <button
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="
            emit(
              'copy',
              formatDebugPayload(record, record.method),
              '完整记录已复制',
            )
          "
        >
          <Copy class="size-4" />
          复制完整
        </button>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">发送消息</h3>
          <button
            class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            type="button"
            @click="emit('copy', requestText, '请求已复制')"
          >
            复制
          </button>
        </div>
        <pre
          class="overflow-auto rounded-md border border-border bg-muted/35 p-3 text-xs leading-relaxed min-h-28"
          >{{ requestText || "无发送内容" }}</pre
        >
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">接收消息</h3>
          <button
            class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            type="button"
            @click="emit('copy', responseText, '响应已复制')"
          >
            复制
          </button>
        </div>
        <pre
          class="overflow-auto rounded-md border border-border bg-muted/35 p-3 text-xs leading-relaxed min-h-28"
          >{{ responseText || "等待响应" }}</pre
        >
      </div>
    </div>
  </aside>
</template>
