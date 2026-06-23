"use client";

import { LoginCard } from "@/components/login-card";

export function AdminAuthScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Inventory Admin</p>
          <div className="space-y-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground">
              Gouvernance des acces et des referentiels
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Ouvrir la console d administration pour gerer les utilisateurs, les roles, les permissions et le contexte organisationnel.
            </p>
          </div>
        </div>
        <LoginCard onLoggedIn={() => window.location.reload()} />
      </div>
    </div>
  );
}
