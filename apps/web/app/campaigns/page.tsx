"use client";

import type {
  CreateInventoryCampaignInput,
  InventoryCampaignDetail,
  InventoryCampaignExpectedPreviewResponse,
  InventoryCampaignSummary,
  PaginatedResponse,
  SpatialNodeListItem,
  SpatialNodeTreeItem,
  OrganizationSettings,
  OrganizationSpatialDisplaySettings
} from "@inventory/shared";
import { buildDefaultOrganizationSettings, formatNumber } from "@inventory/shared";
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
  SelectTrigger,
  SelectValue,
  SpatialNodeTitle,
  StatusBadge,
  Textarea
} from "@inventory/ui";
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, PlayIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildPathWithQuery } from "@/lib/url-query";
import { useStoredToken } from "@/lib/session";

function expectedItemSubtitle(item: InventoryCampaignDetail["expectedItems"][number]) {
  return [
    item.numPiece ? `Piece ${item.numPiece}` : null,
    item.typeLabel,
    item.expectedSpatialPath ?? "sans localisation"
  ]
    .filter(Boolean)
    .join(" - ");
}

function expectedItemModelLine(item: InventoryCampaignDetail["expectedItems"][number]) {
  if (item.brandLabel || item.modelLabel) {
    return [item.brandLabel, item.modelLabel].filter(Boolean).join(" / ");
  }
  return item.familyLabel ?? "-";
}

function CampaignsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = useStoredToken();
  const [campaigns, setCampaigns] = useState<PaginatedResponse<InventoryCampaignSummary> | null>(null);
  const [nodes, setNodes] = useState<SpatialNodeListItem[]>([]);
  const [tree, setTree] = useState<SpatialNodeTreeItem[]>([]);
  const [spatialDisplay, setSpatialDisplay] = useState<OrganizationSpatialDisplaySettings | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<InventoryCampaignDetail | null>(null);
  const [expectedPreview, setExpectedPreview] = useState<InventoryCampaignExpectedPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({ q: "", status: "all", page: 1, pageSize: 10 });
  const [form, setForm] = useState({
    name: "",
    description: "",
    spatialNodeId: "all",
    includeChildren: "true"
  });

  const loadData = useCallback(async () => {
    const status = query.status === "all" ? "" : `&status=${query.status}`;
    const search = query.q ? `&q=${encodeURIComponent(query.q)}` : "";
    const [campaignResponse, nodeResponse, treeResponse, displayResponse] = await Promise.all([
      apiFetch<PaginatedResponse<InventoryCampaignSummary>>(
        `/inventory-campaigns?page=${query.page}&pageSize=${query.pageSize}${status}${search}`
      ),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>("/spatial/nodes?page=1&pageSize=200&sort=path&direction=asc&isActive=true"),
      apiFetch<SpatialNodeTreeItem[]>("/spatial/nodes/tree"),
      apiFetch<OrganizationSpatialDisplaySettings>("/spatial/nodes/display-settings")
    ]);
    setCampaigns(campaignResponse);
    setNodes(nodeResponse.items);
    setTree(treeResponse);
    setSpatialDisplay(displayResponse);
  }, [query.page, query.pageSize, query.q, query.status]);

  useEffect(() => {
    if (!token) return;
    void loadData().catch((loadError) => {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les campagnes");
      }
    });
  }, [loadData, token]);

  const displaySettings = useMemo<OrganizationSettings | null>(() => {
    if (!spatialDisplay) {
      return null;
    }
    return {
      ...buildDefaultOrganizationSettings(),
      spatialDisplay
    };
  }, [spatialDisplay]);

  const nodeCounts = useMemo(() => new Map(nodes.map((node) => [node.id, node.equipmentCount])), [nodes]);

  useEffect(() => {
    if (tree.length === 0) {
      return;
    }
    setExpandedNodeIds((current) => (current.length > 0 ? current : tree.map((node) => node.id)));
  }, [tree]);

  const visibleTree = useMemo(() => {
    const expanded = new Set(expandedNodeIds);
    const rows: SpatialNodeTreeItem[] = [];

    const visit = (node: SpatialNodeTreeItem) => {
      rows.push(node);
      if (!expanded.has(node.id)) {
        return;
      }
      for (const child of node.children) {
        visit(child);
      }
    };

    for (const root of tree) {
      visit(root);
    }

    return rows;
  }, [expandedNodeIds, tree]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === form.spatialNodeId) ?? null,
    [form.spatialNodeId, nodes]
  );

  const selectedNodeEquipmentCount = useMemo(() => {
    if (!selectedNode) {
      return 0;
    }

    if (form.includeChildren !== "true") {
      return selectedNode.equipmentCount;
    }

    return nodes
      .filter((node) => node.path === selectedNode.path || node.path.startsWith(`${selectedNode.path}/`))
      .reduce((total, node) => total + node.equipmentCount, 0);
  }, [form.includeChildren, nodes, selectedNode]);

  const loadCampaign = useCallback(async (campaignId: string) => {
    const detail = await apiFetch<InventoryCampaignDetail>(`/inventory-campaigns/${campaignId}`);
    setSelectedCampaign(detail);
    setExpectedPreview(null);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const campaignId = searchParams.get("campaignId");
    if (!campaignId || selectedCampaign?.id === campaignId) {
      return;
    }

    void loadCampaign(campaignId).catch((loadError) => {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la campagne");
      }
    });
  }, [loadCampaign, searchParams, selectedCampaign?.id, token]);

  useEffect(() => {
    if (!selectedCampaign) {
      return;
    }

    const requestedCampaignId = searchParams.get("campaignId");
    if (requestedCampaignId && requestedCampaignId !== selectedCampaign.id) {
      return;
    }

    const nextPath = buildPathWithQuery(pathname, searchParams, {
      campaignId: selectedCampaign.id
    });
    const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextPath !== currentPath) {
      router.replace(nextPath, { scroll: false });
    }
  }, [pathname, router, searchParams, selectedCampaign]);

  if (!token) {
    return <WebAuthScreen />;
  }

  const createCampaign = async () => {
    if (form.spatialNodeId === "all") {
      setError("Selectionne un perimetre spatial avant de creer la campagne");
      return;
    }
    const payload: CreateInventoryCampaignInput = {
      name: form.name,
      description: form.description || null,
      scopes: [
        {
          spatialNodeId: form.spatialNodeId,
          includeChildren: form.includeChildren === "true"
        }
      ]
    };
    try {
      const created = await apiFetch<InventoryCampaignDetail>("/inventory-campaigns", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSelectedCampaign(created);
      setForm({ name: "", description: "", spatialNodeId: "all", includeChildren: "true" });
      await loadData();
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Creation campagne impossible");
    }
  };

  const campaignAction = async (path: string) => {
    try {
      const updated = await apiFetch<InventoryCampaignDetail>(path, { method: "POST", body: "{}" });
      setSelectedCampaign(updated);
      await loadData();
      setError(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action campagne impossible");
    }
  };

  const previewExpected = async () => {
    if (!selectedCampaign) return;
    try {
      const response = await apiFetch<InventoryCampaignExpectedPreviewResponse>(
        `/inventory-campaigns/${selectedCampaign.id}/preview-expected`,
        { method: "POST", body: "{}" }
      );
      setExpectedPreview(response);
      setError(null);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview attendus impossible");
    }
  };

  return (
    <AppShell>
      <ListPage
        eyebrow="Campagnes"
        title=""
        description="Creation, ouverture et suivi des campagnes terrain sur le referentiel spatial."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher une campagne"
            filters={
              <Select value={query.status} onValueChange={(value) => setQuery((current) => ({ ...current, status: value ?? "all", page: 1 }))}>
                <SelectTrigger className="min-w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                  <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                </SelectContent>
              </Select>
            }
            actions={
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCwIcon className="size-4" />
                Rafraichir
              </Button>
            }
          />
        }
        grid={
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <PageSection title="Liste campagnes" description="Selectionne une campagne pour afficher son detail.">
                <DataGrid
                  rows={campaigns?.items ?? []}
                  columns={[
                    {
                      key: "name",
                      label: "Campagne",
                      render: (item) => <span className="block truncate whitespace-nowrap">{item.name}</span>
                    },
                    {
                      key: "status",
                      label: "Statut",
                      render: (item) => <StatusBadge status={item.status === "OPEN" ? "active" : "neutral"} label={item.status} />
                    },
                    { key: "expected", label: "Attendus", render: (item) => item.expectedItemsCount },
                    { key: "observations", label: "Obs.", render: (item) => item.observationsCount },
                    { key: "anomalies", label: "Anomalies", render: (item) => item.anomaliesCount }
                  ]}
                  getRowId={(item) => item.id}
                  getMobileTitle={(item) => item.name}
                  getMobileDescription={(item) => item.status}
                  rowActions={[
                    { label: "Afficher", onClick: (item) => void loadCampaign(item.id) },
                    { label: "Executer", onClick: (item) => router.push(`/campaigns/${item.id}/run`) }
                  ]}
                  emptyTitle="Aucune campagne"
                  emptyDescription="Cree une campagne depuis le panneau de droite."
                />
              </PageSection>
              <PageSection title="Detail campagne" description="Attendus, observations et actions superviseur.">
                {selectedCampaign ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
                        <p className="font-semibold">{selectedCampaign.status}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attendus</p>
                        <p className="font-semibold">{selectedCampaign.expectedItemsCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Observations</p>
                        <p className="font-semibold">{selectedCampaign.observationsCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Anomalies</p>
                        <p className="font-semibold">{selectedCampaign.anomaliesCount}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Perimetre campagne</p>
                          <div className="mt-2 space-y-2">
                            {selectedCampaign.scopes.map((scope) => (
                              <div key={scope.id} className="rounded-xl border border-border/60 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge status="neutral" label={scope.spatialType} />
                                  <p className="font-medium">{scope.spatialLabel}</p>
                                  <span className="text-xs text-muted-foreground">
                                    {scope.includeChildren ? "Enfants inclus" : "Noeud seul"}
                                  </span>
                                </div>
                                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{scope.spatialPath}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <span className="rounded-full border border-border/60 px-3 py-1 text-sm font-medium">
                          {formatNumber(selectedCampaign.expectedItemsCount)} attendu(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => void previewExpected()}>
                        <EyeIcon className="size-4" />
                        Preview attendus
                      </Button>
                      <Button onClick={() => void campaignAction(`/inventory-campaigns/${selectedCampaign.id}/open`)}>
                        <PlayIcon className="size-4" />
                        Ouvrir
                      </Button>
                      <Button variant="outline" onClick={() => router.push(`/campaigns/${selectedCampaign.id}/run`)}>
                        Executer terrain
                      </Button>
                      <Button variant="outline" onClick={() => void campaignAction(`/inventory-campaigns/${selectedCampaign.id}/close`)}>
                        Cloturer
                      </Button>
                      <Button variant="outline" onClick={() => void campaignAction(`/inventory-campaigns/${selectedCampaign.id}/archive`)}>
                        Archiver
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(expectedPreview?.items ?? selectedCampaign.expectedItems).slice(0, 20).map((item) => (
                        <div key={item.id} className="rounded-xl border border-border/70 p-3">
                          <p className="font-medium">{item.internalCode}</p>
                          <p className="text-sm text-muted-foreground">
                            {expectedItemSubtitle(item)}
                          </p>
                          <p className="text-xs text-muted-foreground">{expectedItemModelLine(item)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Selectionne une campagne.</p>
                )}
              </PageSection>
            </div>

            <FormSection
              title="Creer une campagne"
              description="V1 : un perimetre spatial principal, avec enfants inclus par defaut."
              columns={1}
            >
              <Field label="Nom">
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Description">
                <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Perimetre spatial">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Noeud selectionne
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedNode ? `${selectedNode.label} - ${selectedNode.path}` : "Aucun noeud selectionne"}
                        </p>
                      </div>
                      {selectedNode ? (
                        <span className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {formatNumber(selectedNodeEquipmentCount)} equip.
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="max-h-[26rem] space-y-2 overflow-auto rounded-2xl border border-border/60 bg-background/60 p-3">
                    {visibleTree.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun noeud spatial disponible.</p>
                    ) : null}
                    {visibleTree.map((node) => {
                      const isExpanded = expandedNodeIds.includes(node.id);
                      const isSelected = form.spatialNodeId === node.id;
                      const equipmentCount = nodeCounts.get(node.id) ?? 0;

                      return (
                        <div
                          key={node.id}
                          className="rounded-2xl border border-border/50 bg-background/80 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1" style={{ paddingLeft: `${node.depth * 14}px` }}>
                              <div className="flex min-w-0 items-center gap-2">
                                {node.children.length > 0 ? (
                                  <button
                                    type="button"
                                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                                    onClick={() =>
                                      setExpandedNodeIds((current) =>
                                        current.includes(node.id)
                                          ? current.filter((item) => item !== node.id)
                                          : [...current, node.id]
                                      )
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronDownIcon className="size-4" />
                                    ) : (
                                      <ChevronRightIcon className="size-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="size-6 shrink-0" />
                                )}
                                <SpatialNodeTitle
                                  type={node.type}
                                  label={node.label}
                                  path={node.path}
                                  settings={displaySettings}
                                  className="min-w-0 flex-1"
                                  pathClassName="hidden md:inline-block"
                                />
                              </div>
                              <p className="pl-8 text-xs text-muted-foreground md:hidden">{node.path}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {formatNumber(equipmentCount)} equip.
                              </span>
                              <Button
                                size="sm"
                                variant={isSelected ? "secondary" : "outline"}
                                onClick={() => setForm((current) => ({ ...current, spatialNodeId: node.id }))}
                              >
                                {isSelected ? "Selectionne" : "Selectionner"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Field>
              <Field label="Inclure les equipements des noeuds enfants du noeud selectionne">
                <Select value={form.includeChildren} onValueChange={(value) => setForm((current) => ({ ...current, includeChildren: value ?? "true" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Inclure les enfants</SelectItem>
                    <SelectItem value="false">Noeud seul</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button onClick={() => void createCampaign()}>
                <SaveIcon className="size-4" />
                Creer
              </Button>
            </FormSection>
          </div>
        }
        pagination={null}
      />
    </AppShell>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsPageContent />
    </Suspense>
  );
}
