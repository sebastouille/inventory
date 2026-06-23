import { cn } from "../lib/utils";

interface ReadOnlyFieldProps {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}

export function ReadOnlyField({ label, value, className }: ReadOnlyFieldProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="min-h-11 rounded-xl border border-border/60 bg-background/70 px-4 py-2.5 text-sm text-foreground">
        {value === null || value === undefined || value === "" ? "-" : value}
      </div>
    </div>
  );
}
