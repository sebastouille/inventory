"use client";

import { FormSection, ReadOnlyField, ReadOnlyFormPage } from "@inventory/ui";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { useStoredToken } from "@/lib/session";

export default function SettingsPage() {
  const token = useStoredToken();

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ReadOnlyFormPage
        eyebrow="Espace terrain"
        title="Parametres"
        description="References du workspace web, de la PWA et des exports."
        sections={
          <>
            <FormSection title="Environnement local" description="Valeurs de reference du poste de developpement.">
              <ReadOnlyField label="Web" value="http://localhost:3010" />
              <ReadOnlyField label="API" value="http://localhost:3011/api/v1" />
              <ReadOnlyField label="Admin" value="http://localhost:3014" />
              <ReadOnlyField label="Mailpit" value="http://localhost:8035" />
            </FormSection>
            <FormSection title="Conventions PWA" description="Base mobile retenue dans cette vague.">
              <ReadOnlyField label="Mode mobile" value="Responsive dans apps/web" />
              <ReadOnlyField label="Manifest" value="Actif" />
              <ReadOnlyField label="Offline" value="Non active dans cette vague" />
              <ReadOnlyField label="Export listes" value="ODS" />
            </FormSection>
          </>
        }
      />
    </AppShell>
  );
}
