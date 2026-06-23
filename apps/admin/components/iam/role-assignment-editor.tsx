"use client";

import type { IamRoleSummary, IamScopeSummary, OrganizationSpatialScopePolicy } from "@inventory/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@inventory/ui";

export interface EditableRoleAssignment {
  roleId: string;
  scopeId: string | null;
}

interface RoleAssignmentEditorProps {
  roles: IamRoleSummary[];
  scopes: IamScopeSummary[];
  spatialScopePolicy?: OrganizationSpatialScopePolicy;
  value: EditableRoleAssignment[];
  onChange: (assignments: EditableRoleAssignment[]) => void;
}

export function RoleAssignmentEditor({
  roles,
  scopes,
  spatialScopePolicy = "SCOPED",
  value,
  onChange
}: RoleAssignmentEditorProps) {
  const valueByRoleId = new Map(value.map((assignment) => [assignment.roleId, assignment]));

  return (
    <div className="space-y-3">
      {spatialScopePolicy === "ORGANIZATION_WIDE" ? (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Les scopes saisis sont conserves pour audit, mais ils sont ignores tant que l organisation est en mode
          toute l organisation.
        </div>
      ) : null}
      {roles.map((role) => {
        const assignment = valueByRoleId.get(role.id);
        return (
          <div
            key={role.id}
            className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <input
                  checked={Boolean(assignment)}
                  className="h-4 w-4"
                  type="checkbox"
                  onChange={(event) => {
                    if (event.target.checked) {
                      if (assignment) {
                        return;
                      }
                      onChange([...value, { roleId: role.id, scopeId: null }]);
                      return;
                    }
                    onChange(value.filter((item) => item.roleId !== role.id));
                  }}
                />
                <span className="font-medium">{role.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{role.description}</p>
            </div>
            <Select
              disabled={!assignment}
              value={assignment?.scopeId ?? "global"}
              onValueChange={(nextValue) => {
                const nextScopeId = nextValue === "global" ? null : nextValue;
                onChange(
                  value.map((item) =>
                    item.roleId === role.id
                      ? {
                          ...item,
                          scopeId: nextScopeId
                        }
                      : item
                  )
                );
              }}
            >
              <SelectTrigger className="min-w-[240px]">
                <SelectValue placeholder="Toute l organisation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Toute l organisation</SelectItem>
                {scopes.map((scope) => (
                  <SelectItem key={scope.id} value={scope.id}>
                    {scope.path ? `${scope.type} - ${scope.path}` : `${scope.type} - ${scope.label}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
