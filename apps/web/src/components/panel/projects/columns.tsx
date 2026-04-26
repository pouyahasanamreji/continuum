import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectFull } from "@/types/project";

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

export const columns: ColumnDef<ProjectFull>[] = [
  {
    accessorKey: "path",
    header: sortHeader("Path"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.path}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "name",
    header: sortHeader("Name"),
    cell: ({ row }) => (
      <span className="text-sm">{row.original.name}</span>
    ),
    enableSorting: true,
  },
  {
    accessorFn: (row) => row.createdAt,
    id: "createdAt",
    header: sortHeader("Created"),
    cell: ({ row }) => (
      <span className="text-xs">{dateFmt.format(row.original.createdAt)}</span>
    ),
    sortingFn: (a, b) => a.original.createdAt - b.original.createdAt,
  },
  {
    accessorFn: (row) => row.updatedAt,
    id: "updatedAt",
    header: sortHeader("Updated"),
    cell: ({ row }) => (
      <span className="text-xs">{dateFmt.format(row.original.updatedAt)}</span>
    ),
    sortingFn: (a, b) => a.original.updatedAt - b.original.updatedAt,
  },
];
