"use client";

import type { AssetListItem, EquipmentReferenceItem, ImmobilizationSummary, PaginatedResponse } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import {
  Button,
  DataGrid,
  FilterBar,
  ListPage,
  PageSection,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { DownloadIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiDownload, apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

export default function AssetsPage() {
  const router = useRouter();
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<AssetListItem> | null>(null);
  const [families, setFamilies] = useState<EquipmentReferenceItem[]>([]);
  const [statuses, setStatuses] = useState<EquipmentReferenceItem[]>([]);
  const [immobilizations, setImmobilizations] = useState<ImmobilizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "createdAt" as
      | "internalCode"
      | "serialNumber"
      | "createdAt"
      | "updatedAt"
      | "statusLabel"
      | "ownerLabel"
      | "immobilizationCode",
    direction: "desc" as "asc" | "desc",
    q: "",
    familyId: "all",
    statusId: "all",
    immobilizationId: "all",
    isArchived: "false" as "true" | "false" | "all"
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return Promise.all([
      apiFetch<PaginatedResponse<AssetListItem>>(
        `/assets${buildQueryString({
          page: query.page,
          pageSize: query.pageSize,
          sort: query.sort,
          direction: query.direction,
          q: deferredSearch,
          familyId: query.familyId === "all" ? undefined : query.familyId,
          statusId: query.statusId === "all" ? undefined : query.statusId,
          immobilizationId: query.immobilizationId === "all" ? undefined : query.immobilizationId,
          isArchived: query.isArchived === "all" ? undefined : query.isArchived
        })}`
      ),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/families?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/statuses?state=active"),
      apiFetch<PaginatedResponse<ImmobilizationSummary>>("/immobilizations?page=1&pageSize=200&sort=code&direction=asc")
    ]);
  }, [
    deferredSearch,
    query.direction,
    query.familyId,
    query.immobilizationId,
    query.isArchived,
    query.page,
    query.pageSize,
    query.sort,
    query.statusId,
    token
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const [assets, familiesResponse, statusesResponse, immobilizationsResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setResponse(assets);
        setFamilies(familiesResponse);
        setStatuses(statusesResponse);
        setImmobilizations(immobilizationsResponse.items);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          setResponse(null);
          return;
        }
        setResponse(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les equipements");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const [assets, familiesResponse, statusesResponse, immobilizationsResponse] = await loadData();
      setResponse(assets);
      setFamilies(familiesResponse);
      setStatuses(statusesResponse);
      setImmobilizations(immobilizationsResponse.items);
      setError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setError(null);
        setResponse(null);
        return;
      }
      setResponse(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les equipements");
    }
  };

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Equipements"
        title="Equipements"
        description="Referentiel patrimonial unitaire avec proprietaire, statut et affectations."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par code interne, numero de serie, type, localisation ou immobilisation"
            filters={
              <>
                <Select value={query.familyId} onValueChange={(value) => setQuery((current) => ({ ...current, familyId: value ?? "all", page: 1 }))}>
                  <SelectTrigger className="min-w-52">
                    <SelectValue placeholder="Toutes les familles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les familles</SelectItem>
                    {families.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={query.statusId} onValueChange={(value) => setQuery((current) => ({ ...current, statusId: value ?? "all", page: 1 }))}>
                  <SelectTrigger className="min-w-52">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {statuses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={query.immobilizationId}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, immobilizationId: value ?? "all", page: 1 }))
                  }
                >
                  <SelectTrigger className="min-w-64">
                    <SelectValue placeholder="Toutes les immobilisations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les immobilisations</SelectItem>
                    {immobilizations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={query.isArchived}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, isArchived: (value as typeof current.isArchived) ?? "all", page: 1 }))
                  }
                >
                  <SelectTrigger className="min-w-40">
                    <SelectValue placeholder="Tous les etats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les etats</SelectItem>
                    <SelectItem value="false">Actifs</SelectItem>
                    <SelectItem value="true">Archives</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <>
                <Button variant="outline" onClick={() => void refreshData()}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    apiDownload(
                      `/assets/export${buildQueryString({
                        sort: query.sort,
                        direction: query.direction,
                        q: deferredSearch,
                        familyId: query.familyId === "all" ? undefined : query.familyId,
                        statusId: query.statusId === "all" ? undefined : query.statusId,
                        immobilizationId: query.immobilizationId === "all" ? undefined : query.immobilizationId,
                        isArchived: query.isArchived === "all" ? undefined : query.isArchived
                      })}`
                    )
                  }
                >
                  <DownloadIcon className="size-4" />
                  Exporter ODS
                </Button>
                <Button onClick={() => router.push("/assets/new")}>
                  <PlusIcon className="size-4" />
                  Nouvel equipement
                </Button>
              </>
            }
          />
        }
        grid={
          <PageSection title="Liste des equipements" description="Vue paginee, triable et filtrable.">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DataGrid
              rows={response?.items ?? []}
              columns={[
                {
                  key: "internalCode",
                  label: "Reference produit / code interne",
                  sortable: true,
                  render: (item) => (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.internalCode}</p>
                      {item.externalRef ? <p className="font-mono text-xs text-muted-foreground">Ref externe {item.externalRef}</p> : null}
                    </div>
                  )
                },
                {
                  key: "numPiece",
                  label: "N de piece",
                  render: (item) => item.numPiece ?? "-"
                },
                {
                  key: "type",
                  label: "Type",
                  render: (item) => (
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">{item.equipmentType.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.equipmentModel
                          ? `${item.equipmentModel.brandLabel} / ${item.equipmentModel.label}`
                          : item.equipmentType.familyLabel}
                      </p>
                    </div>
                  )
                },
                {
                  key: "location",
                  label: "Path",
                  render: (item) => item.currentSpatialPath ?? item.currentSpatialLabel ?? "-"
                },
                {
                  key: "immobilizationCode",
                  label: "Immobilisation",
                  sortable: true,
                  render: (item) =>
                    item.immobilizationCode
                      ? `${item.immobilizationCode} - ${item.immobilizationLabel ?? ""}`.trim()
                      : "-"
                },
                {
                  key: "ownerLabel",
                  label: "Proprietaire",
                  sortable: true,
                  render: (item) => item.ownerEntity.label
                },
                {
                  key: "statusLabel",
                  label: "Statut",
                  sortable: true,
                  render: (item) => (
                    <StatusBadge
                      status={item.isDeleted ? "inactive" : "active"}
                      label={item.isDeleted ? `Archive - ${item.equipmentStatus.label}` : item.equipmentStatus.label}
                    />
                  )
                },
                {
                  key: "assignments",
                  label: "Affectations",
                  render: (item) => formatNumber(item.activeAssignments.length)
                }
              ]}
              sort={query.sort}
              direction={query.direction}
              onSortChange={(sort, direction) => setQuery((current) => ({ ...current, sort: sort as typeof current.sort, direction, page: 1 }))}
              getRowId={(item) => item.id}
              getMobileTitle={(item) => item.internalCode}
              getMobileDescription={(item) =>
                [
                  item.numPiece ? `Piece ${item.numPiece}` : null,
                  item.equipmentType.label,
                  item.currentSpatialPath ?? item.currentSpatialLabel
                ]
                  .filter(Boolean)
                  .join(" - ")
              }
              getMobileMeta={(item) => (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {item.equipmentModel
                      ? `${item.equipmentModel.brandLabel} / ${item.equipmentModel.label}`
                      : item.serialNumber ?? "Marque et modele non renseignes"}
                  </p>
                  <StatusBadge status={item.isDeleted ? "inactive" : "active"} label={item.isDeleted ? "Archive" : item.equipmentStatus.label} />
                </div>
              )}
              rowActions={[{ label: "Afficher", onClick: (item) => router.push(`/assets/${item.id}`) }]}
              emptyTitle="Aucun equipement"
              emptyDescription="Aucun equipement ne correspond aux filtres appliques."
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
