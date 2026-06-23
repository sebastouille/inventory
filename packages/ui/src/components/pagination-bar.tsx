import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 50, 100, 200],
  onPageChange,
  onPageSizeChange
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {from}-{to} sur {total}
        </span>
        <div className="flex items-center gap-2">
          <span>Afficher</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
          Precedent
        </Button>
        <span className="min-w-20 text-center text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
