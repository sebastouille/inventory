"use client";

import type { IamPermissionSummary } from "@inventory/shared";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@inventory/ui";

interface RoleWithPermissions {
  id: string;
  code: string;
  label: string;
  permissions: IamPermissionSummary[];
}

interface PermissionMatrixProps {
  roles: RoleWithPermissions[];
}

export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const permissions = Array.from(
    new Map(
      roles.flatMap((role) =>
        role.permissions.map((permission) => [permission.code, permission] as const)
      )
    ).values()
  ).sort((left, right) => left.code.localeCompare(right.code));

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-border/60 xl:block">
        <Table>
          <TableHeader className="bg-secondary/45">
            <TableRow>
              <TableHead className="min-w-64">Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id}>{role.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.code}>
                <TableCell className="align-top">
                  <p className="font-medium">{permission.label}</p>
                  <p className="text-xs text-muted-foreground">{permission.code}</p>
                </TableCell>
                {roles.map((role) => {
                  const hasPermission = role.permissions.some((item) => item.code === permission.code);
                  return (
                    <TableCell key={`${role.id}:${permission.code}`} className="align-top">
                      <Badge variant={hasPermission ? "success" : "outline"}>{hasPermission ? "Oui" : "Non"}</Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 xl:hidden">
        {permissions.map((permission) => (
          <div key={permission.code} className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
            <div className="space-y-1">
              <p className="font-medium text-foreground">{permission.label}</p>
              <p className="text-xs text-muted-foreground">{permission.code}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {roles.map((role) => {
                const hasPermission = role.permissions.some((item) => item.code === permission.code);
                return (
                  <Badge key={`${role.id}:${permission.code}`} variant={hasPermission ? "success" : "outline"}>
                    {role.label}: {hasPermission ? "Oui" : "Non"}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
