import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  size?: "default" | "sm";
  className?: string;
}

export function PageSection({
  title,
  description,
  actions,
  children,
  size = "default",
  className
}: PageSectionProps) {
  return (
    <Card className={className} size={size}>
      {title || description || actions ? (
        <CardHeader className={actions ? "grid-cols-[1fr_auto]" : undefined}>
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="justify-self-end">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
