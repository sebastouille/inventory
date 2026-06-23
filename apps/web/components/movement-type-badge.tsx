"use client";

import { StatusBadge } from "@inventory/ui";

const labels: Record<string, string> = {
  IN: "Entree",
  OUT: "Sortie",
  TRANSFER: "Transfert",
  ADJUSTMENT: "Ajustement"
};

const variants: Record<string, "success" | "destructive" | "warning" | "neutral"> = {
  IN: "success",
  OUT: "destructive",
  TRANSFER: "warning",
  ADJUSTMENT: "neutral"
};

export function MovementTypeBadge({ type }: { type: string }) {
  return <StatusBadge status={variants[type] ?? "neutral"} label={labels[type] ?? type} />;
}
