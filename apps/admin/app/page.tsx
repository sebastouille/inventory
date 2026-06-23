"use client";

import type { CurrentUserResponse, IamRoleDetail, IamUserListItem, PaginatedResponse } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import {
  DashboardPage,
  MetricCard,
  PageSection,
  ReadOnlyField,
  StatusBadge
} from "@inventory/ui";
import {
  KeyRoundIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  WaypointsIcon
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { RoleBadges } from "@/components/iam/role-badges";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function AdminHomePage() {
  const token = useStoredToken();
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [users, setUsers] = useState<PaginatedResponse<IamUserListItem> | null>(null);
  const [roles, setRoles] = useState<PaginatedResponse<IamRoleDetail> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return Promise.all([
      apiFetch<CurrentUserResponse>("/auth/me"),
      apiFetch<PaginatedResponse<IamUserListItem>>("/iam/users?page=1&pageSize=10"),
      apiFetch<PaginatedResponse<IamRoleDetail>>("/iam/roles?page=1&pageSize=50")
    ]);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [meResponse, usersResponse, rolesResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setMe(meResponse);
        setUsers(usersResponse);
        setRoles(rolesResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          setMe(null);
          setUsers(null);
          setRoles(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le tableau de bord");
        setMe(null);
        setUsers(null);
        setRoles(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <DashboardPage
        eyebrow="Administration IAM"
        title="Tableau de bord"
        description="Pilotage des acces, des roles et du contexte organisationnel pour le tenant courant."
        metrics={
          <>
            <MetricCard
              label="Utilisateurs"
              value={formatNumber(users?.total ?? 0)}
              hint="Comptes visibles dans le tenant"
              icon={<UsersRoundIcon className="size-5" />}
            />
            <MetricCard
              label="Roles"
              value={formatNumber(roles?.total ?? 0)}
              hint="Roles systeme disponibles"
              icon={<ShieldCheckIcon className="size-5" />}
            />
            <MetricCard
              label="Permissions"
              value={formatNumber(me?.permissions.length ?? 0)}
              hint="Permissions actives de l operateur"
              icon={<KeyRoundIcon className="size-5" />}
            />
            <MetricCard
              label="Perimetres"
              value={formatNumber(me?.scopeAssignments.length ?? 0)}
              hint="Affectations role plus perimetre"
              icon={<WaypointsIcon className="size-5" />}
            />
          </>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-6 xl:grid-cols-2">
          <PageSection title="Operateur courant" description="Contexte resolu depuis /api/v1/auth/me.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ReadOnlyField label="Nom" value={me?.name ?? "Chargement"} />
              <ReadOnlyField label="Email" value={me?.email ?? "Chargement"} />
              <ReadOnlyField label="Role principal" value={me?.primaryRoleLabel ?? "-"} />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
                <div className="flex min-h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <StatusBadge
                    status={me?.isActive ? "active" : "inactive"}
                    label={me?.isActive ? "Actif" : "Inactif"}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Roles actifs</p>
              <RoleBadges roles={me?.roles ?? []} />
            </div>
          </PageSection>

          <PageSection title="Contexte organisationnel" description="Tenant et rattachement de l operateur.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ReadOnlyField label="Organisation" value={me?.organization.name ?? "Chargement"} />
              <ReadOnlyField label="Slug" value={me?.organization.slug ?? "Chargement"} />
              <ReadOnlyField label="Identifiant" value={me?.organization.id ?? "Chargement"} />
              <ReadOnlyField label="Permissions visibles" value={me?.permissions.length ?? 0} />
            </div>
          </PageSection>
        </div>
      </DashboardPage>
    </AdminShell>
  );
}
