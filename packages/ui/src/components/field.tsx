import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}

export function Field({ label, htmlFor, children, className, labelClassName }: FieldProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <label htmlFor={htmlFor} className={cn("text-sm font-medium text-foreground", labelClassName)}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-32 w-full rounded-xl border border-input bg-background/80 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
