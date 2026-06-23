"use client";

import type {
  CurrentUserResponse,
  OrganizationSettings,
  OrganizationSpatialDisplaySettings,
  PaginatedResponse,
  SpatialNodeListItem,
  SpatialNodeTreeItem
} from "@inventory/shared";
import { formatNumber, SPATIAL_NODE_LIST_MAX_PAGE_SIZE } from "@inventory/shared";
import { buildDefaultOrganizationSettings } from "@inventory/shared";
import {
  Button,
  FilterBar,
  ListPage,
  PageSection,
  ReadOnlyField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SpatialNodeTitle,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { ChevronDownIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { buildPathWithQuery } from "@/lib/url-query";
import { useStoredToken } from "@/lib/session";

function LocationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = useStoredToken();
  const [tree, setTree] = useState<SpatialNodeTreeItem[]>([]);
  const [nodes, setNodes] = useState<SpatialNodeListItem[]>([]);
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [spatialDisplay, setSpatialDisplay] = useState<OrganizationSpatialDisplaySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [query, setQuery] = useState({
    q: "",
    type: "all" as "all" | SpatialNodeListItem["type"],
    perimeterId: searchParams.get("perimeterId") ?? "all"
  });

  useEffect(() => {
    const perimeterId = searchParams.get("perimeterId") ?? "all";
    setQuery((current) => (current.perimeterId === perimeterId ? current : { ...current, perimeterId }));
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    const listQuery = buildQueryString({
      page: 1,
      pageSize: SPATIAL_NODE_LIST_MAX_PAGE_SIZE,
      sort: "path",
      direction: "asc",
      q: query.q || undefined,
      type: query.type === "all" ? undefined : query.type,
      ancestorId: query.perimeterId === "all" ? undefined : query.perimeterId,
      isActive: "true"
    });

    const treeQuery =
      query.perimeterId === "all" ? "" : buildQueryString({ ancestorId: query.perimeterId });

    return Promise.all([
      apiFetch<CurrentUserResponse>("/auth/me"),
      apiFetch<OrganizationSpatialDisplaySettings>("/spatial/nodes/display-settings"),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>(`/spatial/nodes${listQuery}`),
      apiFetch<SpatialNodeTreeItem[]>(`/spatial/nodes/tree${treeQuery}`)
    ]);
  }, [query.perimeterId, query.q, query.type, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [meResponse, spatialDisplayResponse, listResponse, treeResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setMe(meResponse);
        setSpatialDisplay(spatialDisplayResponse);
        setNodes(listResponse.items);
        setTree(treeResponse);
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

  const perimeterOptions = useMemo(() => {
    if (me?.isOrganizationWideSpatialAccess) {
      return nodes.filter((node) => node.depth === 0);
    }

    const scopeNodeIds = new Set(
      (me?.scopeAssignments ?? [])
        .map((assignment) => assignment.scopeSpatialNodeId)
        .filter((scopeNodeId): scopeNodeId is string => Boolean(scopeNodeId))
    );

    if (scopeNodeIds.size === 0) {
      return nodes.filter((node) => node.depth === 0);
    }

    return nodes.filter((node) => scopeNodeIds.has(node.id));
  }, [me?.isOrganizationWideSpatialAccess, me?.scopeAssignments, nodes]);

  const selectedPerimeterLabel = useMemo(() => {
    if (query.perimeterId === "all") {
      return "Tous les perimetres";
    }

    const node = nodes.find((item) => item.id === query.perimeterId);
    return node ? `${node.label} - ${node.path}` : "Perimetre";
  }, [nodes, query.perimeterId]);

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

  const displaySettings = useMemo<OrganizationSettings | null>(() => {
    if (!spatialDisplay) {
      return null;
    }
    return {
      ...buildDefaultOrganizationSettings(),
      spatialDisplay
    };
  }, [spatialDisplay]);

  useEffect(() => {
    const requestedPerimeterId = searchParams.get("perimeterId") ?? "all";
    if (requestedPerimeterId !== query.perimeterId) {
      return;
    }

    const nextPath = buildPathWithQuery(pathname, searchParams, {
      perimeterId: query.perimeterId === "all" ? null : query.perimeterId
    });
    const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextPath !== currentPath) {
      router.replace(nextPath, { scroll: false });
    }
  }, [pathname, query.perimeterId, router, searchParams]);

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Referentiel"
        title="Localisations"
        description="Consultation de la hierarchie spatiale et selection du perimetre de travail."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value }))}
            searchPlaceholder="Rechercher par code ou libelle"
            filters={
              <>
                <Select
                  value={query.type}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, type: (value as typeof current.type) ?? "all" }))
                  }
                >
                  <SelectTrigger className="min-w-40">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="SITE">SITE</SelectItem>
                    <SelectItem value="BUILDING">BUILDING</SelectItem>
                    <SelectItem value="FLOOR">FLOOR</SelectItem>
                    <SelectItem value="ZONE">ZONE</SelectItem>
                    <SelectItem value="ROOM">ROOM</SelectItem>
                    <SelectItem value="LOCATION">LOCATION</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={query.perimeterId}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, perimeterId: value ?? "all" }))
                  }
                >
                  <SelectTrigger className="min-w-60">
                    <span className="flex-1 text-left">{selectedPerimeterLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les perimetres</SelectItem>
                    {perimeterOptions.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.label} - {node.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <Button
                variant="outline"
                onClick={() =>
                  void loadData()
                    .then(([meResponse, spatialDisplayResponse, listResponse, treeResponse]) => {
                      setMe(meResponse);
                      setSpatialDisplay(spatialDisplayResponse);
                      setNodes(listResponse.items);
                      setTree(treeResponse);
                      setError(null);
                    })
                    .catch((loadError) => {
                      setError(
                        loadError instanceof Error
                          ? loadError.message
                          : "Impossible de charger le referentiel spatial"
                      );
                    })
                }
              >
                <RefreshCwIcon className="size-4" />
                Rafraichir
              </Button>
            }
          />
        }
        grid={
          <div className="space-y-6">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <PageSection
                title="Hierarchie spatiale"
                description="Noeuds actifs pour le perimetre selectionne."
              >
                <div className="space-y-2">
                  {visibleTree.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun noeud spatial disponible.</p>
                  ) : null}
                  {visibleTree.map((node) => (
                    <div
                      key={node.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-muted/40"
                      onClick={() =>
                        node.children.length > 0
                          ? setExpandedNodeIds((current) =>
                              current.includes(node.id)
                                ? current.filter((item) => item !== node.id)
                                : [...current, node.id]
                            )
                          : undefined
                      }
                    >
                      <div className="min-w-0" style={{ paddingLeft: `${node.depth * 16}px` }}>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {node.children.length > 0 ? (
                            expandedNodeIds.includes(node.id) ? (
                              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="size-4 shrink-0" />
                          )}
                          <SpatialNodeTitle
                            type={node.type}
                            label={node.label}
                            settings={displaySettings}
                            className="flex-1 min-w-0"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{node.type}</p>
                      </div>
                      <StatusBadge
                        status={node.isActive ? "active" : "inactive"}
                        label={node.isActive ? "Actif" : "Inactif"}
                      />
                    </div>
                  ))}
                </div>
              </PageSection>

              <div className="space-y-6">
                <PageSection
                  title="Perimetre courant"
                  description="Resume du contexte utilisable pour les prochaines campagnes et consultations."
                >
                  <div className="grid gap-4">
                    <ReadOnlyField label="Noeuds visibles" value={formatNumber(nodes.length)} />
                    <ReadOnlyField label="Perimetre selectionne" value={selectedPerimeterLabel} />
                    <ReadOnlyField
                      label="Affectations scope"
                      value={formatNumber(me?.scopeAssignments.length ?? 0)}
                    />
                    <ReadOnlyField
                      label="Mode spatial effectif"
                      value={me?.isOrganizationWideSpatialAccess ? "Toute l organisation" : "Perimetres scopes"}
                    />
                  </div>
                </PageSection>

                <PageSection
                  title="Scopes IAM actifs"
                  description="Scopes rattaches aux roles de l operateur courant."
                >
                  <div className="space-y-2">
                    {me?.isOrganizationWideSpatialAccess ? (
                      <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                        Cette organisation utilise le mode toute l organisation. Les scopes affiches ci-dessous sont
                        conserves pour audit mais n ont pas d effet sur la visibilite.
                      </div>
                    ) : null}
                    {(me?.scopeAssignments ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun scope affecte.</p>
                    ) : null}
                    {(me?.scopeAssignments ?? []).map((assignment) => (
                      <div key={assignment.id} className="rounded-xl border border-border/60 px-3 py-2">
                        <p className="font-medium text-foreground">{assignment.roleLabel}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.scopeType && (assignment.scopePath || assignment.scopeLabel)
                            ? `${assignment.scopeType} - ${assignment.scopePath ?? assignment.scopeLabel}`
                            : "Toute l organisation"}
                        </p>
                      </div>
                    ))}
                  </div>
                </PageSection>

                <PageSection
                  title="Noeuds disponibles"
                  description="Liste a plat utile pour selection rapide."
                >
                  <div className="space-y-2">
                    {nodes.slice(0, 12).map((node) => (
                      <div key={node.id} className="rounded-xl border border-border/60 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <SpatialNodeTitle
                            type={node.type}
                            label={node.label}
                            path={node.path}
                            settings={displaySettings}
                            className="flex-1 min-w-0"
                            pathClassName="md:inline-block hidden"
                          />
                        </div>
                        <p className="font-mono text-xs text-muted-foreground md:hidden">
                          {node.type} - {node.path}
                        </p>
                      </div>
                    ))}
                  </div>
                </PageSection>
              </div>
            </div>
          </div>
        }
        pagination={
          <PageSection
            title="Couverture"
            description="Preparation du perimetre operateur pour les campagnes et les inventaires."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Type filtre
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {query.type === "all" ? "Tous" : query.type}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Noeuds charges
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatNumber(nodes.length)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Scopes relies
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatNumber(me?.scopeAssignments.length ?? 0)}
                </p>
              </div>
            </div>
          </PageSection>
        }
      />
    </AppShell>
  );
}

export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <LocationsPageContent />
    </Suspense>
  );
}
