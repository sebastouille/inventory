"use client";

import { evaluatePasswordPolicy } from "@inventory/shared";
import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface PasswordPolicyChecklistProps {
  password: string;
  confirmation?: string;
  confirmationLabel?: string;
}

export function PasswordPolicyChecklist({
  password,
  confirmation,
  confirmationLabel = "Les deux saisies correspondent"
}: PasswordPolicyChecklistProps) {
  const rules = evaluatePasswordPolicy(password);
  const checks =
    confirmation === undefined
      ? rules
      : [
          ...rules,
          {
            key: "confirmation",
            label: confirmationLabel,
            valid: confirmation.length > 0 && confirmation === password
          }
        ];

  return (
    <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/70 p-4">
      {checks.map((check) => (
        <div
          key={check.key}
          className={cn(
            "flex items-center gap-2 text-sm transition-colors",
            check.valid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          )}
        >
          {check.valid ? <CheckCircle2Icon className="size-4 shrink-0" /> : <CircleAlertIcon className="size-4 shrink-0" />}
          <span>{check.label}</span>
        </div>
      ))}
    </div>
  );
}
