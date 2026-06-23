"use client";

import type {
  OrganizationSettings,
  OrganizationSpatialDisplaySettings,
  PaginatedResponse,
  SpatialNodeListItem,
  SpatialNodeType
} from "@inventory/shared";
import {
  buildDefaultOrganizationSettings,
  formatNumber,
  SPATIAL_NODE_LIST_MAX_PAGE_SIZE,
  SPATIAL_NODE_TYPES
} from "@inventory/shared";
import {
  Button,
  DataGrid,
  Field,
  FilterBar,
  FormSection,
  Input,
  ListPage,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SpatialNodeChip,
  SpatialNodeTitle,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { ArchiveIcon, ChevronDownIcon, ChevronRightIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

type SpatialSummaryResponse = {
  total: number;
  roots: number;
  scopesCount: number;
  lastUpdatedAt: string | null;
  recentNodes: SpatialNodeListItem[];
  countsByType: Array<{
    type: string;
    count: number;
  }>;
};

const ALLOWED_PARENT_TYPES: Record<SpatialNodeType, SpatialNodeType[]> = {
  SITE: [],
  BUILDING: ["SITE"],
  FLOOR: ["BUILDING"],
  ZONE: ["BUILDING", "FLOOR"],
  ROOM: ["BUILDING", "FLOOR", "ZONE"],
  LOCATION: []
};

const emptyForm = {
  id: null as string | null,
  type: "ROOM" as SpatialNodeType,
  code: "",
  label: "",
  description: "",
  parentId: "none",
  externalRef: "",
  sourceClass: "",
  isActive: "true" as "true" | "false"
};

export default function SpatialAdminPage() {
  const token = useStoredToken();
  const [summary, setSummary] = useState<SpatialSummaryResponse | null>(null);
  const [allNodes, setAllNodes] = useState<SpatialNodeListItem[]>([]);
  const [spatialDisplay, setSpatialDisplay] = useState<OrganizationSpatialDisplaySettings | null>(null);
  const [query, setQuery] = useState({
    q: "",
    type: "all" as "all" | SpatialNodeType,
    state: "all" as "all" | "active" | "inactive"
  });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    const queryString = buildQueryString({
      q: query.q || undefined,
      type: query.type === "all" ? undefined : query.type,
      isActive: query.state === "all" ? undefined : query.state === "active" ? "true" : "false",
      page: 1,
      pageSize: SPATIAL_NODE_LIST_MAX_PAGE_SIZE,
      sort: "path",
      direction: "asc"
    });

    return Promise.all([
      apiFetch<OrganizationSpatialDisplaySettings>("/spatial/nodes/display-settings"),
      apiFetch<SpatialSummaryResponse>("/spatial/nodes/summary"),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>(`/spatial/nodes${queryString}`),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>(
        `/spatial/nodes?page=1&pageSize=${SPATIAL_NODE_LIST_MAX_PAGE_SIZE}&sort=path&direction=asc`
      )
    ]);
  }, [query.q, query.state, query.type, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [displayResponse, summaryResponse, , allNodesResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setSpatialDisplay(displayResponse);
        setSummary(summaryResponse);
        setAllNodes(allNodesResponse.items);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le referentiel spatial");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const allowedParentTypes = useMemo(() => ALLOWED_PARENT_TYPES[form.type], [form.type]);

  const parentOptions = useMemo(() => {
    return allNodes.filter((node) => {
      if (!node.isActive) {
        return false;
      }
      if (form.id && node.id === form.id) {
        return false;
      }
      if (form.id) {
        const current = allNodes.find((item) => item.id === form.id);
        if (current && node.path.startsWith(`${current.path}/`)) {
          return false;
        }
      }
      return allowedParentTypes.includes(node.type);
    });
  }, [allNodes, allowedParentTypes, form.id]);

  const selectedParentLabel = useMemo(() => {
    if (form.parentId === "none") {
      return "";
    }
    const parent = parentOptions.find((node) => node.id === form.parentId);
    return parent ? `${parent.label} - ${parent.path}` : "";
  }, [form.parentId, parentOptions]);

  const hasActiveFilters = Boolean(query.q.trim()) || query.type !== "all" || query.state !== "all";

  const childrenByParentId = useMemo(() => {
    const map = new Map<string | null, SpatialNodeListItem[]>();
    for (const node of allNodes) {
      const key = node.parentId ?? null;
      const current = map.get(key) ?? [];
      current.push(node);
      map.set(key, current);
    }

    for (const nodes of map.values()) {
      nodes.sort((left, right) => left.path.localeCompare(right.path));
    }

    return map;
  }, [allNodes]);

  const rootNodes = useMemo(() => childrenByParentId.get(null) ?? [], [childrenByParentId]);

  useEffect(() => {
    if (rootNodes.length === 0) {
      return;
    }

    setExpandedNodeIds((current) => (current.length > 0 ? current : rootNodes.map((node) => node.id)));
  }, [rootNodes]);

  const filteredNodeIds = useMemo(() => {
    const search = query.q.trim().toLowerCase();

    return new Set(
      allNodes
        .filter((node) => {
          if (query.type !== "all" && node.type !== query.type) {
            return false;
          }
          if (query.state === "active" && !node.isActive) {
            return false;
          }
          if (query.state === "inactive" && node.isActive) {
            return false;
          }
          if (!search) {
            return true;
          }

          return [node.label, node.code, node.externalRef ?? "", node.parentLabel ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(search);
        })
        .map((node) => node.id)
    );
  }, [allNodes, query.q, query.state, query.type]);

  const contextualNodeIds = useMemo(() => {
    if (!hasActiveFilters) {
      return null;
    }

    const ids = new Set<string>();
    const nodeById = new Map(allNodes.map((node) => [node.id, node]));

    for (const nodeId of filteredNodeIds) {
      let current = nodeById.get(nodeId) ?? null;
      while (current) {
        ids.add(current.id);
        current = current.parentId ? nodeById.get(current.parentId) ?? null : null;
      }
    }

    return ids;
  }, [allNodes, filteredNodeIds, hasActiveFilters]);

  const forcedExpandedNodeIds = useMemo(() => {
    if (!contextualNodeIds) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    for (const nodeId of contextualNodeIds) {
      if ((childrenByParentId.get(nodeId) ?? []).length > 0) {
        ids.add(nodeId);
      }
    }
    return ids;
  }, [childrenByParentId, contextualNodeIds]);

  const visibleNodes = useMemo(() => {
    const rows: SpatialNodeListItem[] = [];
    const expanded = new Set([...expandedNodeIds, ...forcedExpandedNodeIds]);
    const allowedIds = contextualNodeIds;

    const visit = (node: SpatialNodeListItem) => {
      if (allowedIds && !allowedIds.has(node.id)) {
        return;
      }

      rows.push(node);
      if (!expanded.has(node.id)) {
        return;
      }

      for (const child of childrenByParentId.get(node.id) ?? []) {
        visit(child);
      }
    };

    for (const root of rootNodes) {
      visit(root);
    }

    return rows;
  }, [childrenByParentId, contextualNodeIds, expandedNodeIds, forcedExpandedNodeIds, rootNodes]);

  const displaySettings = useMemo<OrganizationSettings | null>(() => {
    if (!spatialDisplay) {
      return null;
    }
    return {
      ...buildDefaultOrganizationSettings(),
      spatialDisplay
    };
  }, [spatialDisplay]);

  const toggleNode = useCallback(
    (nodeId: string) => {
      setExpandedNodeIds((current) =>
        current.includes(nodeId) ? current.filter((item) => item !== nodeId) : [...current, nodeId]
      );
    },
    [setExpandedNodeIds]
  );

  const refresh = async () => {
    try {
      const [displayResponse, summaryResponse, , allNodesResponse] = await loadData();
      setSpatialDisplay(displayResponse);
      setSummary(summaryResponse);
      setAllNodes(allNodesResponse.items);
      setError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setError(null);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le referentiel spatial");
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSubmitError(null);
  };

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <ListPage
        eyebrow="Administration spatial"
        title="Referentiel spatial"
        description="Navigation, correction et synchronisation du referentiel spatial et des scopes IAM associes."
        filters={
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Noeuds
                </p>
                <p className="text-2xl font-semibold text-foreground">{formatNumber(summary?.total ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Racines
                </p>
                <p className="text-2xl font-semibold text-foreground">{formatNumber(summary?.roots ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Scopes IAM
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatNumber(summary?.scopesCount ?? 0)}
                </p>
              </div>
            </div>
            <FilterBar
              searchValue={query.q}
              onSearchChange={(value) => setQuery((current) => ({ ...current, q: value }))}
              searchPlaceholder="Rechercher par code, libelle ou reference"
              filters={
                <>
                  <Select
                    value={query.type}
                    onValueChange={(value) =>
                      setQuery((current) => ({ ...current, type: (value as typeof current.type) ?? "all" }))
                    }
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {SPATIAL_NODE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={query.state}
                    onValueChange={(value) =>
                      setQuery((current) => ({ ...current, state: (value as typeof current.state) ?? "all" }))
                    }
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue placeholder="Tous les etats" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les etats</SelectItem>
                      <SelectItem value="active">Actifs</SelectItem>
                      <SelectItem value="inactive">Inactifs</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
              actions={
                <Button variant="outline" onClick={() => void refresh()}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
              }
            />
          </div>
        }
        grid={
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <PageSection
              title="Arborescence spatiale"
              description="Noeuds, chemins et etat de synchronisation du perimetre."
            >
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DataGrid
                rows={visibleNodes}
                columns={[
                  {
                    key: "label",
                    label: "Noeud",
                    render: (item) => (
                      <div
                        className="space-y-1"
                        style={{ paddingLeft: `${item.depth * 16}px` }}
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {(childrenByParentId.get(item.id) ?? []).length > 0 ? (
                            expandedNodeIds.includes(item.id) || forcedExpandedNodeIds.has(item.id) ? (
                              <ChevronDownIcon className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="size-4 text-muted-foreground" />
                            )
                          ) : (
                            <span className="size-4" />
                          )}
                          <SpatialNodeTitle
                            type={item.type}
                            label={item.label}
                            settings={displaySettings}
                            className="flex-1 min-w-0"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{item.type}</p>
                      </div>
                    )
                  },
                  {
                    key: "parent",
                    label: "Parent",
                    render: (item) => item.parentLabel ?? item.parentPath ?? "-"
                  },
                  {
                    key: "source",
                    label: "Source",
                    render: (item) => (
                      <span className="text-sm text-muted-foreground">
                        {item.externalSource ?? "n/a"}
                        {item.sourceClass ? ` - ${item.sourceClass}` : ""}
                      </span>
                    )
                  },
                  {
                    key: "status",
                    label: "Etat",
                    render: (item) => (
                      <StatusBadge
                        status={item.isActive ? "active" : "inactive"}
                        label={item.isActive ? "Actif" : "Inactif"}
                      />
                    )
                  }
                ]}
                getRowId={(item) => item.id}
                getMobileTitle={(item) => item.label}
                getMobileDescription={(item) => item.type}
                getMobileMeta={(item) => (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{item.parentLabel ?? "Racine"}</p>
                    <StatusBadge
                      status={item.isActive ? "active" : "inactive"}
                      label={item.isActive ? "Actif" : "Inactif"}
                    />
                  </div>
                )}
                onRowClick={(item) => {
                  if ((childrenByParentId.get(item.id) ?? []).length > 0) {
                    toggleNode(item.id);
                  }
                }}
                rowActions={[
                  {
                    label: "Modifier",
                    onClick: (item) =>
                      setForm({
                        id: item.id,
                        type: item.type,
                        code: item.code,
                        label: item.label,
                        description: item.description ?? "",
                        parentId: item.parentId ?? "none",
                        externalRef: item.externalRef ?? "",
                        sourceClass: item.sourceClass ?? "",
                        isActive: item.isActive ? "true" : "false"
                      })
                  }
                ]}
                emptyTitle="Aucun noeud spatial"
                emptyDescription="Aucun noeud ne correspond aux filtres courants."
              />
            </PageSection>

            <PageSection
              title={form.id ? "Editer un noeud" : "Creer un noeud"}
              description="Creation, correction et archivage des noeuds spatiaux synchronises avec les scopes IAM."
            >
              <div className="space-y-4">
                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
                <FormSection
                  title="Noeud spatial"
                  description="Definition du noeud et de son rattachement parent."
                  columns={1}
                >
                  <Field label="Type">
                    <Select
                      value={form.type}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          type: (value as SpatialNodeType) ?? current.type,
                          parentId: value === "SITE" ? "none" : current.parentId
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPATIAL_NODE_TYPES.filter((type) => type !== "LOCATION" || form.id !== null).map(
                          (type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Code">
                    <Input
                      value={form.code}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, code: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Libelle">
                    <Input
                      value={form.label}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, label: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Input
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </Field>
                  {form.type !== "SITE" ? (
                    <Field label="Parent">
                      <Select
                        value={form.parentId}
                        onValueChange={(value) =>
                          setForm((current) => ({ ...current, parentId: value ?? "none" }))
                        }
                      >
                        <SelectTrigger>
                          <span
                            className={
                              selectedParentLabel
                                ? "flex-1 text-left"
                                : "flex-1 text-left text-muted-foreground"
                            }
                          >
                            {selectedParentLabel || "Choisir un parent"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choisir un parent</SelectItem>
                          {parentOptions.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                              {node.label} - {node.path}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Reference externe">
                    <Input
                      value={form.externalRef}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, externalRef: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Classe source">
                    <Input
                      value={form.sourceClass}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sourceClass: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Etat">
                    <Select
                      value={form.isActive}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          isActive: (value as "true" | "false") ?? "true"
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Actif</SelectItem>
                        <SelectItem value="false">Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FormSection>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      setSubmitError(null);
                      try {
                        const payload = {
                          type: form.type,
                          code: form.code,
                          label: form.label,
                          description: form.description || null,
                          parentId:
                            form.type === "SITE" ? null : form.parentId === "none" ? null : form.parentId,
                          externalRef: form.externalRef || null,
                          sourceClass: form.sourceClass || null,
                          isActive: form.isActive === "true"
                        };

                        if (form.id) {
                          await apiFetch(`/spatial/nodes/${form.id}`, {
                            method: "PATCH",
                            body: JSON.stringify(payload)
                          });
                        } else {
                          await apiFetch("/spatial/nodes", {
                            method: "POST",
                            body: JSON.stringify(payload)
                          });
                        }

                        resetForm();
                        await refresh();
                      } catch (submitLoadError) {
                        if (isUnauthorizedApiError(submitLoadError)) {
                          setSubmitError(null);
                          return;
                        }
                        setSubmitError(
                          submitLoadError instanceof Error
                            ? submitLoadError.message
                            : "Impossible d enregistrer le noeud spatial"
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    <SaveIcon className="size-4" />
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  {form.id ? (
                    <Button
                      variant="outline"
                      disabled={archivingId === form.id}
                      onClick={async () => {
                        setArchivingId(form.id);
                        setSubmitError(null);
                        try {
                          await apiFetch(`/spatial/nodes/${form.id}/archive`, {
                            method: "POST"
                          });
                          resetForm();
                          await refresh();
                        } catch (archiveError) {
                          if (isUnauthorizedApiError(archiveError)) {
                            setSubmitError(null);
                            return;
                          }
                          setSubmitError(
                            archiveError instanceof Error
                              ? archiveError.message
                              : "Impossible d archiver le noeud spatial"
                          );
                        } finally {
                          setArchivingId(null);
                        }
                      }}
                    >
                      <ArchiveIcon className="size-4" />
                      Archiver
                    </Button>
                  ) : null}
                </div>
              </div>
            </PageSection>
          </div>
        }
        pagination={
          <PageSection
            title="Couverture"
            description="Etat du lot F1-L03 sur le referentiel spatial tenant-aware."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Noeuds filtres
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatNumber(visibleNodes.length)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Derniere synchro
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {summary?.lastUpdatedAt ? summary.lastUpdatedAt.slice(0, 16).replace("T", " ") : "n/a"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Formulaire
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {form.id ? "Edition" : "Creation"}
                </p>
              </div>
            </div>
          </PageSection>
        }
      />
    </AdminShell>
  );
}
