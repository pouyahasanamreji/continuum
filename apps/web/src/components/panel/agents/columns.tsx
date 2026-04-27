import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentFull, AgentStatus } from "@/types/agent";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

function statusVariant(
  s: AgentStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "draft":
      return "secondary";
    case "active":
      return "default";
    case "merged":
      return "outline";
    case "abandoned":
      return "destructive";
  }
}

function sortHeader(label: string) {
  return ({ column }: { column: { toggleSorting: (d?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => (
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

export const columns: ColumnDef<AgentFull>[] = [
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
    enableColumnFilter: true,
    filterFn: (row, _id, value: string) => {
      if (!value) return true;
      return row.original.status === value;
    },
  },
  {
    accessorKey: "branch",
    header: sortHeader("Branch"),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.branch}</span>
    ),
  },
  {
    id: "reservedPaths",
    header: "Reserved",
    cell: ({ row }) => {
      const paths = row.original.reservedPaths;
      const count = paths.length;
      if (count === 0)
        return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-default">
                {count}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="text-xs">
                {paths.map((p) => (
                  <li key={p} className="font-mono">
                    {p}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
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
];
