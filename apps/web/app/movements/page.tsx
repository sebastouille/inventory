"use client";

import type { PaginatedResponse, StockMovementListItem } from "@inventory/shared";
import { formatDateTime, formatNumber } from "@inventory/shared";
import { Button, DataGrid, FilterBar, ListPage, PageSection, PaginationBar } from "@inventory/ui";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MovementTypeBadge } from "@/components/movement-type-badge";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

export default function MovementsPage() {
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<StockMovementListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "createdAt" as "createdAt" | "type" | "quantity",
    direction: "desc" as "asc" | "desc",
    q: ""
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return apiFetch<PaginatedResponse<StockMovementListItem>>(
      `/stock-movements${buildQueryString({
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        direction: query.direction,
        q: deferredSearch
      })}`
    );
  }, [deferredSearch, query.direction, query.page, query.pageSize, query.sort, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const movements = await loadData();
        if (cancelled) {
          return;
        }
        setResponse(movements);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setResponse(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les mouvements");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const movements = await loadData();
      setResponse(movements);
      setError(null);
    } catch (loadError) {
      setResponse(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les mouvements");
    }
  };

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Flux"
        title="Mouvements stock"
        description="Journal des entrees, sorties, transferts et ajustements du stock products."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par produit, SKU, type ou raison"
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
                      `/stock-movements/export${buildQueryString({
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
          />
        }
        grid={
          <PageSection title="Journal des mouvements stock" description="Ecritures recentes et recherche plein texte.">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DataGrid
              rows={response?.items ?? []}
              columns={[
                {
                  key: "product",
                  label: "Produit",
                  render: (item) => (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.product.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.product.sku}</p>
                    </div>
                  )
                },
                {
                  key: "type",
                  label: "Type",
                  sortable: true,
                  render: (item) => <MovementTypeBadge type={item.type} />
                },
                {
                  key: "quantity",
                  label: "Quantite",
                  sortable: true,
                  align: "right",
                  render: (item) => formatNumber(item.quantity)
                },
                {
                  key: "reason",
                  label: "Raison",
                  render: (item) => <span className="text-sm text-muted-foreground">{item.reason ?? "-"}</span>
                },
                {
                  key: "createdAt",
                  label: "Date",
                  sortable: true,
                  render: (item) => (
                    <span className="text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</span>
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
              getRowId={(item) => item.id}
              getMobileTitle={(item) => item.product.name}
              getMobileDescription={(item) => item.product.sku}
              getMobileMeta={(item) => (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MovementTypeBadge type={item.type} />
                    <span className="text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Quantite {formatNumber(item.quantity)}{item.reason ? ` - ${item.reason}` : ""}
                  </div>
                </div>
              )}
              emptyTitle="Aucun mouvement"
              emptyDescription="Aucun mouvement ne correspond a la recherche courante."
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
