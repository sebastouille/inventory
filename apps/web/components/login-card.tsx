"use client";

import { ForcedPasswordChangeCard, AuthLoginCard } from "@inventory/ui";
import { useState } from "react";
import type { PasswordChangeRequiredResponse } from "@inventory/shared";
import { completePasswordChange, login, setStoredToken } from "@/lib/api";

interface LoginCardProps {
  onLoggedIn: () => void;
}

export function LoginCard({ onLoggedIn }: LoginCardProps) {
  const [challenge, setChallenge] = useState<PasswordChangeRequiredResponse | null>(null);

  if (challenge) {
    return (
      <ForcedPasswordChangeCard
        title="Nouveau mot de passe requis"
        description="Ce compte doit redefinir son mot de passe avant d acceder a l espace terrain."
        submitLabel="Valider le nouveau mot de passe"
        user={challenge.user}
        onSubmit={async (newPassword) => {
          const result = await completePasswordChange({
            passwordChangeToken: challenge.passwordChangeToken,
            newPassword
          });
          setStoredToken(result.accessToken);
          onLoggedIn();
        }}
      />
    );
  }

  return (
    <AuthLoginCard
      title="Acces espace terrain"
      description="Saisir l organisation, l email et le mot de passe fournis par l administrateur."
      submitLabel="Ouvrir l espace"
      onSubmit={async (input) => {
        const result = await login(input);
        if (result.status === "PASSWORD_CHANGE_REQUIRED") {
          setChallenge(result);
          return;
        }
        setStoredToken(result.accessToken);
        onLoggedIn();
      }}
    />
  );
}
