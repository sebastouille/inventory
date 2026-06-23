"use client";

import { LoginCard } from "@/components/login-card";

export function WebAuthScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid w-full gap-5 lg:grid-cols-[1fr_0.92fr] lg:gap-8">
        <div className="space-y-3 self-start pt-2 sm:space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">INVENTAIRE</p>
          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Physique & rapprochement comptable
            </h1>
          </div>
        </div>
        <LoginCard onLoggedIn={() => window.location.reload()} />
      </div>
    </div>
  );
}
