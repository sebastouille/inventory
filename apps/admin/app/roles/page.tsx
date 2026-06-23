"use client";

import type { IamPermissionSummary, IamRoleDetail, PaginatedResponse } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import {
  Button,
  DashboardPage,
  DataGrid,
  FilterBar,
  MetricCard,
  PageSection,
  PaginationBar,
  StatusBadge
} from "@inventory/ui";
import { DownloadIcon, KeyRoundIcon, RefreshCwIcon, ShieldCheckIcon, WaypointsIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { PermissionMatrix } from "@/components/iam/permission-matrix";
import { apiDownload, apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

export default function RolesPage() {
  const token = useStoredToken();
  const [rolesResponse, setRolesResponse] = useState<PaginatedResponse<IamRoleDetail> | null>(null);
  const [permissions, setPermissions] = useState<IamPermissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 50,
    sort: "label" as "label" | "code",
    direction: "asc" as "asc" | "desc",
    q: ""
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return Promise.all([
      apiFetch<PaginatedResponse<IamRoleDetail>>(
        `/iam/roles${buildQueryString({
          page: query.page,
          pageSize: query.pageSize,
          sort: query.sort,
          direction: query.direction,
          q: deferredSearch
        })}`
      ),
      apiFetch<IamPermissionSummary[]>("/iam/permissions")
    ]);
  }, [deferredSearch, query.direction, query.page, query.pageSize, query.sort, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [roles, permissionsResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setRolesResponse(roles);
        setPermissions(permissionsResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setRolesResponse(null);
          setPermissions([]);
          setError(null);
          return;
        }
        setRolesResponse(null);
        setPermissions([]);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les roles");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const [roles, permissionsResponse] = await loadData();
      setRolesResponse(roles);
      setPermissions(permissionsResponse);
      setError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setRolesResponse(null);
        setPermissions([]);
        setError(null);
        return;
      }
      setRolesResponse(null);
      setPermissions([]);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les roles");
    }
  };

  if (!token) {
    return <AdminAuthScreen />;
  }

  const domainsCount = new Set(permissions.map((permission) => permission.domain)).size;
  const systemRolesCount = rolesResponse?.items.filter((role) => role.isSystem).length ?? 0;

  return (
    <AdminShell>
      <DashboardPage
        eyebrow="Administration IAM"
        title="Roles et permissions"
        description="Catalogue des roles metiers, liste des permissions explicites et matrice de couverture."
        actions={
          <>
            <Button variant="outline" onClick={() => void refreshData()}>
              <RefreshCwIcon className="size-4" />
              Rafraichir
            </Button>
            <Button
              variant="outline"
              onClick={async () =>
                apiDownload(
                  `/iam/roles/export${buildQueryString({
                    sort: query.sort,
                    direction: query.direction,
                    q: deferredSearch
                  })}`
                )
              }
            >
              <DownloadIcon className="size-4" />
              Exporter ODS
            </Button>
          </>
        }
        metrics={
          <>
            <MetricCard
              label="Roles"
              value={formatNumber(rolesResponse?.total ?? 0)}
              hint="Catalogue IAM visible"
              icon={<ShieldCheckIcon className="size-5" />}
            />
            <MetricCard
              label="Permissions"
              value={formatNumber(permissions.length)}
              hint="Permissions seedes et exposees"
              icon={<KeyRoundIcon className="size-5" />}
            />
            <MetricCard
              label="Domaines"
              value={formatNumber(domainsCount)}
              hint="Regroupements metier"
              icon={<WaypointsIcon className="size-5" />}
            />
            <MetricCard
              label="Roles systeme"
              value={formatNumber(systemRolesCount)}
              hint="Roles proteges en V1"
              icon={<ShieldCheckIcon className="size-5" />}
            />
          </>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <FilterBar
          searchValue={query.q}
          onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
          searchPlaceholder="Rechercher un role par code ou libelle"
        />

        <PageSection title="Catalogue des roles" description="Vue paginee et triable des roles IAM.">
          <DataGrid
            rows={rolesResponse?.items ?? []}
            columns={[
              {
                key: "label",
                label: "Role",
                sortable: true,
                render: (role) => (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{role.label}</p>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                )
              },
              {
                key: "code",
                label: "Code",
                sortable: true,
                render: (role) => <span className="font-mono text-xs text-muted-foreground">{role.code}</span>
              },
              {
                key: "permissions",
                label: "Permissions",
                render: (role) => formatNumber(role.permissions.length)
              },
              {
                key: "status",
                label: "Type",
                render: (role) => (
                  <StatusBadge
                    status={role.isSystem ? "success" : "neutral"}
                    label={role.isSystem ? "Systeme" : "Evolutif"}
                  />
                )
              }
            ]}
            sort={query.sort}
            direction={query.direction}
            onSortChange={(sort, direction) =>
              setQuery((current) => ({
                ...current,
                sort: sort as typeof current.sort,
                direction,
                page: 1
              }))
            }
            getRowId={(role) => role.id}
            getMobileTitle={(role) => role.label}
            getMobileDescription={(role) => role.description}
            getMobileMeta={(role) => (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={role.isSystem ? "success" : "neutral"}
                  label={role.isSystem ? "Systeme" : "Evolutif"}
                />
                <span className="font-mono text-xs text-muted-foreground">{role.code}</span>
              </div>
            )}
            emptyTitle="Aucun role"
            emptyDescription="Aucun role ne correspond a la recherche courante."
          />
        </PageSection>

        <PaginationBar
          page={rolesResponse?.page ?? query.page}
          pageSize={rolesResponse?.pageSize ?? query.pageSize}
          total={rolesResponse?.total ?? 0}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setQuery((current) => ({ ...current, pageSize, page: 1 }))}
        />

        <PageSection title="Matrice des permissions" description="Lecture transverse des permissions par role.">
          <PermissionMatrix roles={rolesResponse?.items ?? []} />
        </PageSection>
      </DashboardPage>
    </AdminShell>
  );
}
