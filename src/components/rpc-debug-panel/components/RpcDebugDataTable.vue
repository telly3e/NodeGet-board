<script
  setup
  lang="ts"
  generic="TData extends Record<string, unknown> | object"
>
import { computed } from "vue";
import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
} from "@tanstack/vue-table";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = withDefaults(
  defineProps<{
    columns: ColumnDef<TData, any>[];
    data: TData[];
    emptyText?: string;
    rowClass?: (row: TData) => string;
    rowKey?: (row: TData, index: number) => string;
    onRowClick?: (row: TData) => void;
  }>(),
  {
    emptyText: "暂无数据",
  },
);

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  getCoreRowModel: getCoreRowModel(),
});

const columnCount = computed(
  () => table.getAllLeafColumns().length || props.columns.length || 1,
);

const metaClass = (meta: unknown, key: "headerClass" | "cellClass") => {
  if (!meta || typeof meta !== "object") return "";
  return String((meta as Record<string, unknown>)[key] ?? "");
};
</script>

<template>
  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader class="bg-muted/60">
        <TableRow
          v-for="headerGroup in table.getHeaderGroups()"
          :key="headerGroup.id"
        >
          <TableHead
            v-for="header in headerGroup.headers"
            :key="header.id"
            :class="[
              'h-9 px-3 text-xs font-medium text-muted-foreground',
              metaClass(header.column.columnDef.meta, 'headerClass'),
            ]"
            :style="{ width: `${header.getSize()}px` }"
          >
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="(row, index) in table.getRowModel().rows"
          :key="rowKey ? rowKey(row.original, index) : row.id"
          :class="[
            onRowClick ? 'cursor-pointer' : '',
            rowClass?.(row.original),
          ]"
          @click="onRowClick?.(row.original)"
        >
          <TableCell
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :class="[
              'h-10 px-3',
              metaClass(cell.column.columnDef.meta, 'cellClass'),
            ]"
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </TableCell>
        </TableRow>
        <TableEmpty
          v-if="table.getRowModel().rows.length === 0"
          :colspan="columnCount"
          class="text-muted-foreground"
        >
          {{ emptyText }}
        </TableEmpty>
      </TableBody>
    </Table>
  </div>
</template>
