import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ActionBarProps {
  primary?: ReactNode;
  secondary?: ReactNode;
  destructive?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function ActionBar({ primary, secondary, destructive, sticky = false, className }: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm md:flex-row md:items-center md:justify-between",
        sticky ? "sticky bottom-4 z-20 backdrop-blur" : undefined,
        className
      )}
    >
      <div className="flex flex-wrap gap-2">{secondary}</div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {destructive}
        {primary}
      </div>
    </div>
  );
}
