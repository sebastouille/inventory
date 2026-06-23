import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-card/60">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        {icon ? <div className="rounded-full bg-secondary p-3 text-secondary-foreground">{icon}</div> : null}
        <div className="space-y-2">
          <p className="font-heading text-lg font-semibold text-foreground">{title}</p>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
