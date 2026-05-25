<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { ServerCog } from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NodeManageTabAgents from "@/components/node-manage/NodeManageTabAgents.vue";
import NodeManageTabServers from "@/components/node-manage/NodeManageTabServers.vue";
import { isPrivatePanelEnabled } from "@/config/privatePanel";

definePage({
  meta: {
    title: "router.nodeManage",
    icon: ServerCog,
    order: 2,
    group: "router.group.monitor",
  },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const privatePanel = isPrivatePanelEnabled();

const activeTab = computed({
  get: () =>
    privatePanel ? "agents" : (route.query.tab as string) || "agents",
  set: (value) => {
    if (privatePanel) return;
    // router.push({ query: { ...route.query, tab: value } });
    // if(value === 'agents'){
    //   router.push({ query: { tab: value } });
    //   return
    // }
    router.push({ query: { tab: value } });
  },
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t("dashboard.nodeManage.title") }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("dashboard.nodeManage.desc") }}
        </p>
      </div>
    </div>

    <Tabs v-model="activeTab">
      <TabsList v-if="!privatePanel">
        <TabsTrigger value="agents">
          {{ t("dashboard.agents.title") }}
        </TabsTrigger>
        <TabsTrigger value="servers">
          {{ t("dashboard.servers.title") }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agents">
        <NodeManageTabAgents ref="agentsRef" />
      </TabsContent>
      <TabsContent v-if="!privatePanel" value="servers">
        <NodeManageTabServers />
      </TabsContent>
    </Tabs>
  </div>
</template>
