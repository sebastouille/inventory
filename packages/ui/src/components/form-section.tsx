import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
  className
}: FormSectionProps) {
  return (
    <section className={cn("space-y-5 rounded-xl border border-border/60 bg-card/70 p-6 md:p-7", className)}>
      <div className="space-y-1.5">
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className={cn("grid gap-5 md:gap-6", columns === 2 ? "lg:grid-cols-2" : "grid-cols-1")}>{children}</div>
    </section>
  );
}
