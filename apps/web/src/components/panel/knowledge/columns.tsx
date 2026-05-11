import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, PencilIcon, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KnowledgeSummary } from "@/types/knowledge";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

function sortHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      toggleSorting: (d?: boolean) => void;
      getIsSorted: () => false | "asc" | "desc";
    };
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{label}</span>
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );
}

export interface KnowledgeRowActions {
  onEdit: (row: KnowledgeSummary) => void;
  onDelete: (row: KnowledgeSummary) => void;
}

export function makeColumns(
  actions: KnowledgeRowActions,
): ColumnDef<KnowledgeSummary>[] {
  return [
    {
      accessorKey: "slug",
      header: sortHeader("Slug"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.slug}</span>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, _id, value: string) =>
        row.original.slug.toLowerCase().includes(value.toLowerCase()),
    },
    {
      accessorKey: "agentSlug",
      id: "agentSlug",
      header: sortHeader("Agent"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.agentSlug}</span>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, _id, value: string) => {
        if (!value) return true;
        return row.original.agentSlug
          .toLowerCase()
          .includes(value.toLowerCase());
      },
    },
    {
      accessorKey: "kind",
      id: "kind",
      header: sortHeader("Kind"),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.kind === "fundamental" ? "default" : "secondary"
          }
        >
          {row.original.kind}
        </Badge>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, _id, value: string) => {
        if (!value || value === "all") return true;
        return row.original.kind === value;
      },
    },
    {
      accessorFn: (row) => row.createdAt,
      id: "createdAt",
      header: sortHeader("Created"),
      cell: ({ row }) => (
        <span className="text-xs">
          {dateFmt.format(new Date(row.original.createdAt))}
        </span>
      ),
      sortingFn: (a, b) =>
        new Date(a.original.createdAt).getTime() -
        new Date(b.original.createdAt).getTime(),
    },
    {
      accessorFn: (row) => row.updatedAt,
      id: "updatedAt",
      header: sortHeader("Updated"),
      cell: ({ row }) => (
        <span className="text-xs">
          {dateFmt.format(new Date(row.original.updatedAt))}
        </span>
      ),
      sortingFn: (a, b) =>
        new Date(a.original.updatedAt).getTime() -
        new Date(b.original.updatedAt).getTime(),
    },
    {
      id: "actions",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              actions.onEdit(row.original);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Edit"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              actions.onDelete(row.original);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Delete"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}
