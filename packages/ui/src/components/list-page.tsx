import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

interface ListPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  filters: ReactNode;
  grid: ReactNode;
  pagination: ReactNode;
}

export function ListPage({
  eyebrow,
  title,
  description,
  actions,
  filters,
  grid,
  pagination
}: ListPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {filters}
      {grid}
      {pagination}
    </div>
  );
}
