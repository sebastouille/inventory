"use client";

import type { PaginatedResponse, ProductListItem } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import {
  Button,
  DataGrid,
  FilterBar,
  ListPage,
  PageSection,
  PaginationBar,
  StatusBadge
} from "@inventory/ui";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

export default function ProductsPage() {
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<ProductListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "name" as "name" | "sku" | "minStock" | "totalQuantity",
    direction: "asc" as "asc" | "desc",
    q: ""
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return apiFetch<PaginatedResponse<ProductListItem>>(
      `/products${buildQueryString({
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
        const products = await loadData();
        if (cancelled) {
          return;
        }
        setResponse(products);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setResponse(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les biens");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const products = await loadData();
      setResponse(products);
      setError(null);
    } catch (loadError) {
      setResponse(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les biens");
    }
  };

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Referentiel"
        title="Biens"
        description="Catalogue des articles, seuils de stock et rattachements fournisseurs."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par nom, SKU, categorie ou fournisseur"
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
                      `/products/export${buildQueryString({
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
          <PageSection title="Catalogue des biens" description="Vue paginee, triable et exportable.">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DataGrid
              rows={response?.items ?? []}
              columns={[
                {
                  key: "name",
                  label: "Bien",
                  sortable: true,
                  render: (item) => (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                  )
                },
                {
                  key: "supplier",
                  label: "Fournisseur",
                  render: (item) => <span className="text-sm text-muted-foreground">{item.supplierName ?? "-"}</span>
                },
                {
                  key: "category",
                  label: "Categorie",
                  render: (item) => <span className="text-sm text-muted-foreground">{item.categoryName ?? "-"}</span>
                },
                {
                  key: "totalQuantity",
                  label: "Stock",
                  sortable: true,
                  align: "right",
                  render: (item) => formatNumber(item.totalQuantity)
                },
                {
                  key: "minStock",
                  label: "Seuil",
                  sortable: true,
                  align: "right",
                  render: (item) => formatNumber(item.minStock)
                },
                {
                  key: "active",
                  label: "Statut",
                  render: (item) => (
                    <StatusBadge
                      status={item.active ? "active" : "inactive"}
                      label={item.active ? "Actif" : "Inactif"}
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
              getRowId={(item) => item.id}
              getMobileTitle={(item) => item.name}
              getMobileDescription={(item) => item.sku}
              getMobileMeta={(item) => (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>Stock {formatNumber(item.totalQuantity)}</span>
                    <span>Seuil {formatNumber(item.minStock)}</span>
                  </div>
                  <StatusBadge
                    status={item.active ? "active" : "inactive"}
                    label={item.active ? "Actif" : "Inactif"}
                  />
                </div>
              )}
              emptyTitle="Aucun bien"
              emptyDescription="Aucun bien ne correspond aux filtres appliques."
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
