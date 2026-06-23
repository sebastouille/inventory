export type SortDirection = "asc" | "desc";
export type ExportFormat = "ods";

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: SortDirection;
  q?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExportableListQuery extends ListQuery {
  format?: ExportFormat;
}
