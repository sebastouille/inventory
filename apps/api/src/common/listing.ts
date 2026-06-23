import type { PaginatedResponse, SortDirection } from "@inventory/shared";

export function normalizeSearchTerm(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function matchesSearchTerm(search: string, values: Array<string | null | undefined>) {
  if (!search) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(search));
}

export function sortItems<T>(
  items: T[],
  accessor: ((item: T) => string | number | null | undefined) | undefined,
  direction: SortDirection
) {
  if (!accessor) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftValue = accessor(left);
    const rightValue = accessor(right);

    if (leftValue == null && rightValue == null) {
      return 0;
    }
    if (leftValue == null) {
      return direction === "asc" ? 1 : -1;
    }
    if (rightValue == null) {
      return direction === "asc" ? -1 : 1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }

    const result = String(leftValue).localeCompare(String(rightValue));
    return direction === "asc" ? result : -result;
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);

  return {
    items: pagedItems,
    total,
    page: currentPage,
    pageSize,
    totalPages
  };
}
