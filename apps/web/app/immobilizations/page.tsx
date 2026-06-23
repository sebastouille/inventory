"use client";

import type {
  ImmobilizationDetail,
  ImmobilizationEquipmentSummary,
  ImmobilizationSummary,
  PaginatedResponse
} from "@inventory/shared";
import { formatDate, formatNumber } from "@inventory/shared";
import {
  Button,
  DataGrid,
  Field,
  FilterBar,
  FormSection,
  Input,
  ListPage,
  PageSection,
  PaginationBar,
  ReadOnlyField,
  StatusBadge,
  Textarea
} from "@inventory/ui";
import { ArchiveIcon, PlusIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { buildPathWithQuery } from "@/lib/url-query";
import { useStoredToken } from "@/lib/session";

interface ImmobilizationFormState {
  code: string;
  label: string;
  description: string;
  status: string;
  costCenter: string;
  purchaseValue: string;
  purchaseDate: string;
  serviceStartAt: string;
  sourceSystem: string;
  externalRef: string;
}

const emptyForm: ImmobilizationFormState = {
  code: "",
  label: "",
  description: "",
  status: "",
  costCenter: "",
  purchaseValue: "",
  purchaseDate: "",
  serviceStartAt: "",
  sourceSystem: "",
  externalRef: ""
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toFormState(item: ImmobilizationSummary): ImmobilizationFormState {
  return {
    code: item.code,
    label: item.label,
    description: item.description ?? "",
    status: item.status ?? "",
    costCenter: item.costCenter ?? "",
    purchaseValue: item.purchaseValue ?? "",
    purchaseDate: toDateInputValue(item.purchaseDate),
    serviceStartAt: toDateInputValue(item.serviceStartAt),
    sourceSystem: item.sourceSystem ?? "",
    externalRef: item.externalRef ?? ""
  };
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ImmobilizationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<ImmobilizationSummary> | null>(null);
  const [selected, setSelected] = useState<ImmobilizationSummary | ImmobilizationDetail | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");
  const [form, setForm] = useState<ImmobilizationFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [urlSelectionReady, setUrlSelectionReady] = useState(false);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "code" as
      | "code"
      | "label"
      | "status"
      | "costCenter"
      | "createdAt"
      | "updatedAt"
      | "equipmentsCount",
    direction: "asc" as "asc" | "desc",
    q: "",
    isActive: "all" as "true" | "false" | "all"
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }
    return apiFetch<PaginatedResponse<ImmobilizationSummary>>(
      `/immobilizations${buildQueryString({
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        direction: query.direction,
        q: deferredSearch,
        isActive: query.isActive === "all" ? undefined : query.isActive
      })}`
    );
  }, [deferredSearch, query.direction, query.isActive, query.page, query.pageSize, query.sort, token]);

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
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les immobilisations");
      setResponse(null);
    }
  }, [loadData]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void refreshData();
  }, [refreshData, token]);

  const openDetailById = useCallback(
    async (immobilizationId: string) => {
      const detail = await apiFetch<ImmobilizationDetail>(`/immobilizations/${immobilizationId}`);
      setSelected(detail);
      setForm(toFormState(detail));
      setMode("view");
      setError(null);
    },
    []
  );

  const openDetail = async (item: ImmobilizationSummary) => {
    setSelected(item);
    setForm(toFormState(item));
    setMode("view");
    setError(null);
    try {
      await openDetailById(item.id);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setError(null);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Impossible d ouvrir l immobilisation");
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    const immobilizationId = searchParams.get("immobilizationId");
    if (!immobilizationId) {
      setUrlSelectionReady(true);
      return;
    }
    if (selected?.id === immobilizationId) {
      setUrlSelectionReady(true);
      return;
    }

    let cancelled = false;
    setUrlSelectionReady(false);
    void openDetailById(immobilizationId)
      .catch((loadError) => {
        if (cancelled || isUnauthorizedApiError(loadError)) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible d ouvrir l immobilisation");
      })
      .finally(() => {
        if (!cancelled) {
          setUrlSelectionReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [openDetailById, searchParams, selected?.id, token]);

  useEffect(() => {
    if (!urlSelectionReady) {
      return;
    }

    const requestedImmobilizationId = searchParams.get("immobilizationId");
    if (requestedImmobilizationId && requestedImmobilizationId !== selected?.id) {
      return;
    }

    const nextPath = buildPathWithQuery(pathname, searchParams, {
      immobilizationId: selected?.id ?? null
    });
    const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextPath !== currentPath) {
      router.replace(nextPath, { scroll: false });
    }
  }, [pathname, router, searchParams, selected?.id, urlSelectionReady]);

  if (!token) {
    return <WebAuthScreen />;
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code,
        label: form.label,
        description: normalizeOptional(form.description),
        status: normalizeOptional(form.status),
        costCenter: normalizeOptional(form.costCenter),
        purchaseValue: normalizeOptional(form.purchaseValue),
        purchaseDate: normalizeOptional(form.purchaseDate),
        serviceStartAt: normalizeOptional(form.serviceStartAt),
        sourceSystem: normalizeOptional(form.sourceSystem),
        externalRef: normalizeOptional(form.externalRef)
      };
      const saved = selected
        ? await apiFetch<ImmobilizationSummary>(`/immobilizations/${selected.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          })
        : await apiFetch<ImmobilizationSummary>("/immobilizations", {
            method: "POST",
            body: JSON.stringify(payload)
          });
      setSelected(saved);
      setForm(toFormState(saved));
      setMode("edit");
      await refreshData();
    } catch (saveError) {
      if (isUnauthorizedApiError(saveError)) {
        setError(null);
        return;
      }
      setError(saveError instanceof Error ? saveError.message : "Impossible d enregistrer l immobilisation");
    } finally {
      setSaving(false);
    }
  };

  const archiveSelected = async () => {
    if (!selected) {
      return;
    }
    const confirmed = window.confirm(
      "Archiver cette immobilisation ? Les equipements rattaches ne seront pas detaches."
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const archived = await apiFetch<ImmobilizationSummary>(`/immobilizations/${selected.id}/archive`, {
        method: "POST"
      });
      setSelected(archived);
      setForm(toFormState(archived));
      await refreshData();
    } catch (archiveError) {
      if (isUnauthorizedApiError(archiveError)) {
        setError(null);
        return;
      }
      setError(archiveError instanceof Error ? archiveError.message : "Impossible d archiver l immobilisation");
    } finally {
      setSaving(false);
    }
  };

  const selectedEquipments: ImmobilizationEquipmentSummary[] =
    selected && "equipments" in selected ? selected.equipments : [];

  return (
    <AppShell>
      <ListPage
        eyebrow="Comptabilite"
        title="Immobilisations"
        description="Referentiel comptable rattache aux equipements physiques."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par code, libelle, statut, centre de cout ou reference"
            filters={
              <select
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                value={query.isActive}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    isActive: event.target.value as typeof current.isActive,
                    page: 1
                  }))
                }
              >
                <option value="all">Tous les etats</option>
                <option value="true">Actives</option>
                <option value="false">Archivees</option>
              </select>
            }
            actions={
              <>
                <Button variant="outline" onClick={() => void refreshData()}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
                <Button
                  onClick={() => {
                    setSelected(null);
                    setForm(emptyForm);
                    setMode("create");
                  }}
                >
                  <PlusIcon className="size-4" />
                  Nouvelle immobilisation
                </Button>
              </>
            }
          />
        }
        grid={
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <PageSection title="Liste des immobilisations" description="Vue paginee et triable du referentiel comptable.">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DataGrid
                rows={response?.items ?? []}
                columns={[
                  {
                    key: "code",
                    label: "Code",
                    sortable: true,
                    render: (item) => (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{item.code}</p>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                      </div>
                    )
                  },
                  { key: "status", label: "Statut", sortable: true, render: (item) => item.status ?? "-" },
                  {
                    key: "costCenter",
                    label: "Centre de cout",
                    sortable: true,
                    render: (item) => item.costCenter ?? "-"
                  },
                  {
                    key: "equipmentsCount",
                    label: "Equipements",
                    sortable: true,
                    render: (item) => (
                      <div className="flex items-center gap-2">
                        <span>{formatNumber(item.equipmentsCount)}</span>
                        {item.equipmentsCount > 1 ? <StatusBadge status="warning" label="Partagee" /> : null}
                      </div>
                    )
                  },
                  {
                    key: "active",
                    label: "Etat",
                    render: (item) => (
                      <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Active" : "Archivee"} />
                    )
                  }
                ]}
                sort={query.sort}
                direction={query.direction}
                onSortChange={(sort, direction) =>
                  setQuery((current) => ({ ...current, sort: sort as typeof current.sort, direction, page: 1 }))
                }
                getRowId={(item) => item.id}
                getMobileTitle={(item) => item.code}
                getMobileDescription={(item) => item.label}
                getMobileMeta={(item) => `${formatNumber(item.equipmentsCount)} equipement(s)`}
                rowActions={[
                  {
                    label: "Afficher",
                    onClick: (item) => {
                      void openDetail(item);
                    }
                  },
                  {
                    label: "Modifier",
                    onClick: (item) => {
                      setSelected(item);
                      setForm(toFormState(item));
                      setMode("edit");
                    }
                  }
                ]}
                emptyTitle="Aucune immobilisation"
                emptyDescription="Aucune immobilisation ne correspond aux filtres."
              />
            </PageSection>

            {mode === "view" && selected ? (
              <PageSection
                title="Consultation immobilisation"
                description="Informations comptables et equipements rattaches."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadOnlyField label="Code" value={selected.code} />
                  <ReadOnlyField label="Libelle" value={selected.label} />
                  <ReadOnlyField label="Statut" value={selected.status ?? "-"} />
                  <ReadOnlyField label="Centre de cout" value={selected.costCenter ?? "-"} />
                  <ReadOnlyField label="Valeur achat" value={selected.purchaseValue ?? "-"} />
                  <ReadOnlyField label="Date achat" value={selected.purchaseDate ? formatDate(selected.purchaseDate) : "-"} />
                  <ReadOnlyField
                    label="Mise en service"
                    value={selected.serviceStartAt ? formatDate(selected.serviceStartAt) : "-"}
                  />
                  <ReadOnlyField label="Systeme source" value={selected.sourceSystem ?? "-"} />
                  <ReadOnlyField label="Reference externe" value={selected.externalRef ?? "-"} />
                  <ReadOnlyField label="Equipements rattaches" value={formatNumber(selected.equipmentsCount)} />
                </div>
                {selected.description ? (
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</p>
                    <p className="mt-1 text-sm text-foreground">{selected.description}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setForm(toFormState(selected));
                      setMode("edit");
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      setForm(emptyForm);
                      setMode("create");
                    }}
                  >
                    Fermer
                  </Button>
                </div>
                <DataGrid
                  rows={selectedEquipments}
                  columns={[
                    {
                      key: "internalCode",
                      label: "Equipement",
                      render: (item) => (
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.internalCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.serialNumber ?? "Numero de serie non renseigne"}
                          </p>
                        </div>
                      )
                    },
                    { key: "type", label: "Type", render: (item) => item.equipmentTypeLabel },
                    { key: "status", label: "Statut", render: (item) => item.equipmentStatusLabel },
                    {
                      key: "location",
                      label: "Localisation",
                      render: (item) => item.currentSpatialLabel ?? item.currentSpatialPath ?? "-"
                    },
                    {
                      key: "state",
                      label: "Etat",
                      render: (item) => (
                        <StatusBadge status={item.isDeleted ? "inactive" : "active"} label={item.isDeleted ? "Archive" : "Actif"} />
                      )
                    }
                  ]}
                  getRowId={(item) => item.id}
                  getMobileTitle={(item) => item.internalCode}
                  getMobileDescription={(item) => item.equipmentTypeLabel}
                  rowActions={[
                    {
                      label: "Ouvrir",
                      onClick: (item) => {
                        window.location.href = `/assets/${item.id}`;
                      }
                    }
                  ]}
                  emptyTitle="Aucun equipement rattache"
                  emptyDescription="Cette immobilisation n est rattachee a aucun equipement."
                />
              </PageSection>
            ) : (
              <FormSection
                title={mode === "edit" ? "Editer une immobilisation" : "Creer une immobilisation"}
                description="Referentiel comptable V1. Le rattachement aux equipements se fait depuis la fiche equipement."
                columns={1}
              >
                <Field label="Code">
                  <Input
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  />
                </Field>
                <Field label="Libelle">
                  <Input
                    value={form.label}
                    onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </Field>
                <Field label="Statut">
                  <Input
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  />
                </Field>
                <Field label="Centre de cout">
                  <Input
                    value={form.costCenter}
                    onChange={(event) => setForm((current) => ({ ...current, costCenter: event.target.value }))}
                  />
                </Field>
                <Field label="Valeur achat">
                  <Input
                    inputMode="decimal"
                    value={form.purchaseValue}
                    onChange={(event) => setForm((current) => ({ ...current, purchaseValue: event.target.value }))}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date achat">
                    <Input
                      className="max-w-44"
                      type="date"
                      value={form.purchaseDate}
                      onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                    />
                  </Field>
                  <Field label="Mise en service">
                    <Input
                      className="max-w-44"
                      type="date"
                      value={form.serviceStartAt}
                      onChange={(event) => setForm((current) => ({ ...current, serviceStartAt: event.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Systeme source">
                  <Input
                    placeholder="SINERGI, SAP, SEED..."
                    value={form.sourceSystem}
                    onChange={(event) => setForm((current) => ({ ...current, sourceSystem: event.target.value }))}
                  />
                </Field>
                <Field label="Reference externe">
                  <Input
                    value={form.externalRef}
                    onChange={(event) => setForm((current) => ({ ...current, externalRef: event.target.value }))}
                  />
                </Field>
                {selected ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Creation</p>
                      <p className="font-medium">{formatDate(selected.createdAt)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Equipements</p>
                      <p className="font-medium">{formatNumber(selected.equipmentsCount)}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={saving} onClick={() => void submit()}>
                    <SaveIcon className="size-4" />
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      setForm(emptyForm);
                      setMode("create");
                    }}
                  >
                    Annuler
                  </Button>
                  {selected ? (
                    <Button variant="destructive" disabled={saving || !selected.isActive} onClick={() => void archiveSelected()}>
                      <ArchiveIcon className="size-4" />
                      {selected.isActive ? "Archiver" : "Archivee"}
                    </Button>
                  ) : null}
                </div>
              </FormSection>
            )}
          </div>
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

export default function ImmobilizationsPage() {
  return (
    <Suspense fallback={null}>
      <ImmobilizationsPageContent />
    </Suspense>
  );
}
