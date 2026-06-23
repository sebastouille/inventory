import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

interface DetailPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside: ReactNode;
  children: ReactNode;
}

export function DetailPage({
  eyebrow,
  title,
  description,
  actions,
  aside,
  children
}: DetailPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">{aside}</div>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
