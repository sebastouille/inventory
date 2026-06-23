import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-[0_24px_80px_-48px_rgba(11,31,58,0.55)] backdrop-blur md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
        ) : null}
        {title || description ? (
          <div className="space-y-1">
            {title ? (
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
            ) : null}
            {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
