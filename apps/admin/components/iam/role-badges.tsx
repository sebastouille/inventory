"use client";

import type { IamRoleSummary } from "@inventory/shared";
import { Badge } from "@inventory/ui";

interface RoleBadgesProps {
  roles: Pick<IamRoleSummary, "id" | "label" | "code">[];
}

export function RoleBadges({ roles }: RoleBadgesProps) {
  if (roles.length === 0) {
    return <Badge variant="outline">Aucun role</Badge>;
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2">
      {roles.map((role) => (
        <Badge key={role.id} variant="secondary" title={role.code}>
          {role.label}
        </Badge>
      ))}
    </div>
  );
}
