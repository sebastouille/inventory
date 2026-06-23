"use client";

import { EmptyState, PageSection, ReadOnlyFormPage } from "@inventory/ui";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { useStoredToken } from "@/lib/session";

interface WorkspacePlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function WorkspacePlaceholderPage({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription
}: WorkspacePlaceholderPageProps) {
  const token = useStoredToken();

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ReadOnlyFormPage
        eyebrow={eyebrow}
        title={title}
        description={description}
        sections={
          <PageSection>
            <EmptyState title={emptyTitle} description={emptyDescription} />
          </PageSection>
        }
      />
    </AppShell>
  );
}
