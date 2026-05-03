<script setup lang="ts">
import RpcDebugPanel from "@/components/rpc-debug-panel/RpcDebugPanel.vue";

definePage({
  meta: {
    title: "RPC 调试",
    order: 3,
  },
});
</script>

<template>
  <RpcDebugPanel />
</template>
