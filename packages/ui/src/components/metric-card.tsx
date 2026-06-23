import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface MetricCardProps {
  label: string;
  value: number | string;
  hint?: string;
  delta?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export function MetricCard({ label, value, hint, delta, icon, onClick }: MetricCardProps) {
  return (
    <Card
      size="sm"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(onClick ? "cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : undefined)}
    >
      <CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle>
        </div>
        {icon ? <div className="shrink-0 rounded-xl bg-primary/8 p-2 text-primary">{icon}</div> : null}
      </CardHeader>
      {hint || delta ? (
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {delta ? <Badge variant="secondary">{delta}</Badge> : null}
          {hint ? <span>{hint}</span> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
