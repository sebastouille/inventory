import type { ReactNode } from "react";
import { ActionBar } from "./action-bar";
import { PageHeader } from "./page-header";

interface ReadOnlyFormPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  sections: ReactNode;
  secondaryActions?: ReactNode;
}

export function ReadOnlyFormPage({
  eyebrow,
  title,
  description,
  sections,
  secondaryActions
}: ReadOnlyFormPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="space-y-5">{sections}</div>
      {secondaryActions ? <ActionBar secondary={secondaryActions} /> : null}
    </div>
  );
}
