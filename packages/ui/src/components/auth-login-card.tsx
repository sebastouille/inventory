"use client";

import { useId, useState } from "react";
import { LockKeyholeIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Field } from "./field";
import { Input } from "./ui/input";

interface AuthLoginCardProps {
  title: string;
  description: string;
  submitLabel: string;
  organizationLabel?: string;
  emailLabel?: string;
  passwordLabel?: string;
  defaultOrganizationSlug?: string;
  defaultEmail?: string;
  defaultPassword?: string;
  onSubmit: (input: { organizationSlug: string; email: string; password: string }) => Promise<void>;
}

export function AuthLoginCard({
  title,
  description,
  submitLabel,
  organizationLabel = "Organisation",
  emailLabel = "Email",
  passwordLabel = "Mot de passe",
  defaultOrganizationSlug = "",
  defaultEmail = "",
  defaultPassword = "",
  onSubmit
}: AuthLoginCardProps) {
  const organizationInputId = useId();
  const emailInputId = useId();
  const passwordInputId = useId();
  const [organizationSlug, setOrganizationSlug] = useState(defaultOrganizationSlug);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <LockKeyholeIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label={organizationLabel} htmlFor={organizationInputId}>
          <Input
            id={organizationInputId}
            value={organizationSlug}
            onChange={(event) => setOrganizationSlug(event.target.value)}
          />
        </Field>
        <Field label={emailLabel} htmlFor={emailInputId}>
          <Input
            id={emailInputId}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
          />
        </Field>
        <Field label={passwordLabel} htmlFor={passwordInputId}>
          <Input
            id={passwordInputId}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          className="w-full"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await onSubmit({ organizationSlug, email, password });
            } catch (loginError) {
              setError(loginError instanceof Error ? loginError.message : "Connexion impossible");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Connexion..." : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
