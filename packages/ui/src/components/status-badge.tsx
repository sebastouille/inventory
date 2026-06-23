import { Badge } from "./ui/badge";

interface StatusBadgeProps {
  status: "active" | "inactive" | "success" | "warning" | "destructive" | "neutral";
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const variant =
    status === "active" || status === "success"
      ? "success"
      : status === "warning"
        ? "warning"
        : status === "destructive" || status === "inactive"
          ? "destructive"
          : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}
