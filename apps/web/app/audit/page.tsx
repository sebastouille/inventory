"use client";

import { WorkspacePlaceholderPage } from "@/components/workspace-placeholder-page";

export default function AuditPage() {
  return (
    <WorkspacePlaceholderPage
      eyebrow="Flux"
      title="Audit"
      description="Le shell supporte deja ce futur module pour visualiser les traces et actions sensibles."
      emptyTitle="Module a venir"
      emptyDescription="Les journaux d audit seront raccordes plus tard avec les memes composants de grille et d export."
    />
  );
}
