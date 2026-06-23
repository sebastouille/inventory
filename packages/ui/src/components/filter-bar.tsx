import type { ReactNode } from "react";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  showFiltersLabel?: boolean;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  filters,
  actions,
  showFiltersLabel = true
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-xs lg:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filters ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
            {showFiltersLabel ? (
              <Button variant="ghost" size="sm" disabled>
                <SlidersHorizontalIcon className="size-4" />
                Filtres
              </Button>
            ) : null}
            {filters}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-nowrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
