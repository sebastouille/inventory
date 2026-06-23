"use client";

import type { EquipmentMovementSummary, PaginatedResponse } from "@inventory/shared";
import { formatDateTime } from "@inventory/shared";
import {
  Button,
  DataGrid,
  FilterBar,
  ListPage,
  PageSection,
  PaginationBar,
  ReadOnlyField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

function movementTypeLabel(type: EquipmentMovementSummary["movementType"]) {
  return {
    INITIAL_STATE: "Etat initial",
    LOCATION_CHANGED: "Changement de localisation",
    ASSIGNMENT_ADDED: "Affectation ajoutee",
    ASSIGNMENT_REMOVED: "Affectation retiree",
    ASSIGNMENT_CHANGED: "Affectation modifiee"
  }[type];
}

function movementSourceLabel(source: EquipmentMovementSummary["source"]) {
  return {
    USER: "Utilisateur",
    IMPORT: "Import",
    SYSTEM: "Systeme"
  }[source];
}

function assignmentLabel(snapshot: EquipmentMovementSummary["toAssignmentSnapshot"]) {
  if (!snapshot) {
    return "-";
  }
  if (snapshot.assignmentType === "PERSON") {
    return snapshot.targetUserName ?? snapshot.targetUserEmail ?? snapshot.targetPersonName ?? "-";
  }
  return snapshot.targetEquipmentInternalCode
    ? `${snapshot.targetEquipmentInternalCode} - ${
        snapshot.targetEquipmentModelLabel ?? snapshot.targetEquipmentTypeLabel ?? ""
      }`.trim()
    : "-";
}

function movementBeforeAfter(movement: EquipmentMovementSummary) {
  if (movement.movementType === "LOCATION_CHANGED" || movement.toSpatialSnapshot || movement.fromSpatialSnapshot) {
    return {
      before: movement.fromSpatialSnapshot?.label ?? "-",
      after: movement.toSpatialSnapshot?.label ?? "-"
    };
  }
  return {
    before: assignmentLabel(movement.fromAssignmentSnapshot),
    after: assignmentLabel(movement.toAssignmentSnapshot)
  };
}

export default function EquipmentMovementsPage() {
  const router = useRouter();
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<EquipmentMovementSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "createdAt" as "createdAt" | "movementType" | "source" | "equipmentInternalCode",
    direction: "desc" as "asc" | "desc",
    q: "",
    movementType: "all",
    source: "all"
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }
    return apiFetch<PaginatedResponse<EquipmentMovementSummary>>(
      `/equipment-movements${buildQueryString({
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        direction: query.direction,
        q: deferredSearch,
        movementType: query.movementType === "all" ? undefined : query.movementType,
        source: query.source === "all" ? undefined : query.source
      })}`
    );
  }, [
    deferredSearch,
    query.direction,
    query.movementType,
    query.page,
    query.pageSize,
    query.sort,
    query.source,
    token
  ]);

  const refreshData = useCallback(async () => {
    try {
      const data = await loadData();
      setResponse(data);
      setError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setError(null);
        setResponse(null);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les mouvements equipements");
      setResponse(null);
    }
  }, [loadData]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void refreshData();
  }, [refreshData, token]);

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Mouvements"
        title="Mouvements equipements"
        description="Journal metier des changements de localisation et d affectation des equipements unitaires."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par equipement, localisation, utilisateur ou asset parent"
            filters={
              <>
                <Select
                  value={query.movementType}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, movementType: value ?? "all", page: 1 }))
                  }
                >
                  <SelectTrigger className="min-w-56">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="INITIAL_STATE">Etat initial</SelectItem>
                    <SelectItem value="LOCATION_CHANGED">Changement de localisation</SelectItem>
                    <SelectItem value="ASSIGNMENT_ADDED">Affectation ajoutee</SelectItem>
                    <SelectItem value="ASSIGNMENT_REMOVED">Affectation retiree</SelectItem>
                    <SelectItem value="ASSIGNMENT_CHANGED">Affectation modifiee</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={query.source}
                  onValueChange={(value) => setQuery((current) => ({ ...current, source: value ?? "all", page: 1 }))}
                >
                  <SelectTrigger className="min-w-44">
                    <SelectValue placeholder="Toutes les sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les sources</SelectItem>
                    <SelectItem value="USER">Utilisateur</SelectItem>
                    <SelectItem value="IMPORT">Import</SelectItem>
                    <SelectItem value="SYSTEM">Systeme</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <Button variant="outline" onClick={() => void refreshData()}>
                <RefreshCwIcon className="size-4" />
                Rafraichir
              </Button>
            }
          />
        }
        grid={
          <PageSection title="Journal des mouvements equipements" description="Vue paginee, triable et filtrable.">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DataGrid
              rows={response?.items ?? []}
              columns={[
                {
                  key: "equipmentInternalCode",
                  label: "Equipement",
                  sortable: true,
                  render: (movement) => (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{movement.equipmentInternalCode}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</p>
                    </div>
                  )
                },
                {
                  key: "movementType",
                  label: "Type",
                  sortable: true,
                  render: (movement) => movementTypeLabel(movement.movementType)
                },
                {
                  key: "source",
                  label: "Source",
                  sortable: true,
                  render: (movement) => (
                    <StatusBadge status="neutral" label={movementSourceLabel(movement.source)} />
                  )
                },
                {
                  key: "before",
                  label: "Avant",
                  render: (movement) => movementBeforeAfter(movement).before
                },
                {
                  key: "after",
                  label: "Apres",
                  render: (movement) => movementBeforeAfter(movement).after
                },
                {
                  key: "createdBy",
                  label: "Utilisateur",
                  render: (movement) => movement.createdByName ?? movement.createdByEmail ?? "-"
                }
              ]}
              sort={query.sort}
              direction={query.direction}
              onSortChange={(sort, direction) =>
                setQuery((current) => ({ ...current, sort: sort as typeof current.sort, direction, page: 1 }))
              }
              getRowId={(movement) => movement.id}
              getMobileTitle={(movement) => movement.equipmentInternalCode}
              getMobileDescription={(movement) => movementTypeLabel(movement.movementType)}
              getMobileMeta={(movement) => {
                const values = movementBeforeAfter(movement);
                return (
                  <div className="space-y-2">
                    <StatusBadge status="neutral" label={movementSourceLabel(movement.source)} />
                    <div className="grid grid-cols-2 gap-2">
                      <ReadOnlyField label="Avant" value={values.before} />
                      <ReadOnlyField label="Apres" value={values.after} />
                    </div>
                  </div>
                );
              }}
              rowActions={[
                {
                  label: "Ouvrir equipement",
                  onClick: (movement) => router.push(`/assets/${movement.equipmentId}`)
                }
              ]}
              emptyTitle="Aucun mouvement equipement"
              emptyDescription="Aucun mouvement ne correspond aux filtres appliques."
            />
          </PageSection>
        }
        pagination={
          <PaginationBar
            page={response?.page ?? query.page}
            pageSize={response?.pageSize ?? query.pageSize}
            total={response?.total ?? 0}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
            onPageSizeChange={(pageSize) => setQuery((current) => ({ ...current, pageSize, page: 1 }))}
          />
        }
      />
    </AppShell>
  );
}
