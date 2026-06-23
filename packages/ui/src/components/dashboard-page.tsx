import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { PageHeader } from "./page-header";

interface DashboardPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function DashboardPage({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  children,
  className
}: DashboardPageProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {metrics ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics}</div> : null}
      {children}
    </div>
  );
}
