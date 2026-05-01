import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  rowCount: number;
  hasNextPage: boolean;
  isLoading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function TablePagination({
  page,
  pageSize,
  rowCount,
  hasNextPage,
  isLoading = false,
  onPrevious,
  onNext,
}: TablePaginationProps) {
  return (
    <div className="flex flex-col gap-2 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-muted-foreground">
        Showing {rowCount} of up to {pageSize}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>
        <span className="min-w-16 text-center text-xs font-medium">
          Page {page}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNextPage || isLoading}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
