"use client";

import { isPasswordPolicySatisfied, type PasswordChangeChallengeUserSummary } from "@inventory/shared";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Field } from "./field";
import { PasswordPolicyChecklist } from "./password-policy-checklist";
import { Input } from "./ui/input";

interface ForcedPasswordChangeCardProps {
  title: string;
  description: string;
  submitLabel: string;
  user: PasswordChangeChallengeUserSummary;
  onSubmit: (newPassword: string) => Promise<void>;
}

export function ForcedPasswordChangeCard({
  title,
  description,
  submitLabel,
  user,
  onSubmit
}: ForcedPasswordChangeCardProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = isPasswordPolicySatisfied(password) && confirmation.length > 0 && confirmation === password;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <KeyRoundIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{user.name ?? user.email}</p>
          <p>{user.email}</p>
          <p>{user.organization.name}</p>
        </div>
        <Field label="Nouveau mot de passe">
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" />
        </Field>
        <PasswordPolicyChecklist password={password} confirmation={confirmation} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          className="w-full"
          disabled={loading || !canSubmit}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onSubmit(password);
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Changement de mot de passe impossible");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Enregistrement..." : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
