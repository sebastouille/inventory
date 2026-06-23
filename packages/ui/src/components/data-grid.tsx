"use client";

import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, MoreHorizontalIcon } from "lucide-react";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { EmptyState } from "./empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface DataGridColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  align?: "left" | "right";
  render: (item: T) => ReactNode;
}

export interface DataGridAction<T> {
  label: string;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
  isVisible?: (item: T) => boolean;
  isDisabled?: (item: T) => boolean;
}

interface DataGridProps<T> {
  rows: T[];
  columns: DataGridColumn<T>[];
  sort?: string;
  direction?: "asc" | "desc";
  onSortChange?: (sort: string, direction: "asc" | "desc") => void;
  getRowId: (item: T) => string;
  getMobileTitle: (item: T) => ReactNode;
  getMobileDescription?: (item: T) => ReactNode;
  getMobileMeta?: (item: T) => ReactNode;
  rowActions?: DataGridAction<T>[];
  desktopRowActionsMode?: "inline" | "menu";
  onRowClick?: (item: T) => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  emptyTitle: string;
  emptyDescription: string;
}

export function DataGrid<T>({
  rows,
  columns,
  sort,
  direction = "asc",
  onSortChange,
  getRowId,
  getMobileTitle,
  getMobileDescription,
  getMobileMeta,
  rowActions,
  desktopRowActionsMode = "inline",
  onRowClick,
  selectedIds = [],
  onSelectedIdsChange,
  emptyTitle,
  emptyDescription
}: DataGridProps<T>) {
  const selectionEnabled = Boolean(onSelectedIdsChange);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(getRowId(row)));

  const toggleAll = (checked: boolean) => {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(checked ? rows.map((row) => getRowId(row)) : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(checked ? [...selectedIds, id] : selectedIds.filter((item) => item !== id));
  };

  const handleSort = (columnKey: string) => {
    if (!onSortChange) return;
    const nextDirection = sort === columnKey && direction === "asc" ? "desc" : "asc";
    onSortChange(columnKey, nextDirection);
  };

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm xl:block">
        <div className="overflow-x-auto rounded-2xl">
          <Table>
          <TableHeader className="bg-secondary/45">
            <TableRow>
              {selectionEnabled ? (
                <TableHead className="w-10">
                  <input
                    aria-label="Tout selectionner"
                    checked={allSelected}
                    type="checkbox"
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.align === "right" ? "text-right" : undefined, column.className)}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 font-medium"
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                      {sort === column.key ? (
                        direction === "asc" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />
                      ) : (
                        <ArrowUpDownIcon className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
              {rowActions?.length ? <TableHead className="w-14 text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = getRowId(row);
              const checked = selectedIds.includes(id);
              const visibleActions = rowActions?.filter((action) => (action.isVisible ? action.isVisible(row) : true)) ?? [];

              return (
                <TableRow
                  key={id}
                  data-state={checked ? "selected" : undefined}
                  className={cn(onRowClick ? "cursor-pointer" : undefined)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectionEnabled ? (
                    <TableCell className="w-10">
                      <input
                        aria-label={`Selection ${id}`}
                        checked={checked}
                        type="checkbox"
                        onChange={(event) => toggleOne(id, event.target.checked)}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(column.align === "right" ? "text-right" : undefined, column.className)}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {visibleActions.length > 0 ? (
                    <TableCell className="text-right">
                      {desktopRowActionsMode === "menu" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" onClick={(event) => event.stopPropagation()} />}
                          >
                            <MoreHorizontalIcon className="size-4" />
                            <span className="sr-only">Actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {visibleActions.map((action) => (
                              <DropdownMenuItem
                                key={action.label}
                                variant={action.variant}
                                disabled={action.isDisabled ? action.isDisabled(row) : false}
                                onClick={() => action.onClick(row)}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {visibleActions.map((action) => (
                            <Button
                              key={action.label}
                              size="sm"
                              variant={action.variant === "destructive" ? "destructive" : "outline"}
                              disabled={action.isDisabled ? action.isDisabled(row) : false}
                              onClick={(event) => {
                                event.stopPropagation();
                                action.onClick(row);
                              }}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 xl:hidden">
        {rows.map((row) => {
          const id = getRowId(row);
          const checked = selectedIds.includes(id);
          const visibleActions = rowActions?.filter((action) => (action.isVisible ? action.isVisible(row) : true)) ?? [];
          return (
            <div
              key={id}
              className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
              data-state={checked ? "selected" : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-heading text-base font-semibold text-foreground">{getMobileTitle(row)}</div>
                  {getMobileDescription ? (
                    <div className="text-sm text-muted-foreground">{getMobileDescription(row)}</div>
                  ) : null}
                </div>
                {selectionEnabled ? (
                  <input
                    aria-label={`Selection ${id}`}
                    checked={checked}
                    type="checkbox"
                    onChange={(event) => toggleOne(id, event.target.checked)}
                  />
                ) : null}
              </div>
              {getMobileMeta ? <div className="mt-4">{getMobileMeta(row)}</div> : null}
              {visibleActions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleActions.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={action.variant === "destructive" ? "destructive" : "outline"}
                      disabled={action.isDisabled ? action.isDisabled(row) : false}
                      onClick={() => action.onClick(row)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
