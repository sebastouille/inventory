import type { ReactNode } from "react";
import { ActionBar } from "./action-bar";
import { PageHeader } from "./page-header";

interface EditFormPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  headerActions?: ReactNode;
  sections: ReactNode;
  primaryActions: ReactNode;
  secondaryActions?: ReactNode;
  destructiveActions?: ReactNode;
}

export function EditFormPage({
  eyebrow,
  title,
  description,
  headerActions,
  sections,
  primaryActions,
  secondaryActions,
  destructiveActions
}: EditFormPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={headerActions} />
      <div className="space-y-5">{sections}</div>
      <ActionBar sticky primary={primaryActions} secondary={secondaryActions} destructive={destructiveActions} />
    </div>
  );
}
