"use client";

import type { PaginatedResponse, SupplierListItem } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import { Button, DataGrid, FilterBar, ListPage, PageSection, PaginationBar } from "@inventory/ui";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiDownload, apiFetch } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

export default function SuppliersPage() {
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<SupplierListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "name" as "name" | "email" | "productsCount",
    direction: "asc" as "asc" | "desc",
    q: ""
  });
  const deferredSearch = useDeferredValue(query.q);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return apiFetch<PaginatedResponse<SupplierListItem>>(
      `/suppliers${buildQueryString({
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
        const suppliers = await loadData();
        if (cancelled) {
          return;
        }
        setResponse(suppliers);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setResponse(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les fournisseurs");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const suppliers = await loadData();
      setResponse(suppliers);
      setError(null);
    } catch (loadError) {
      setResponse(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les fournisseurs");
    }
  };

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <ListPage
        eyebrow="Referentiel"
        title="Fournisseurs"
        description="Carnet des partenaires et rattachements produits."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par nom, email ou telephone"
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
                      `/suppliers/export${buildQueryString({
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
          <PageSection title="Annuaire fournisseurs" description="Liste paginee et triable des partenaires.">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DataGrid
              rows={response?.items ?? []}
              columns={[
                {
                  key: "name",
                  label: "Fournisseur",
                  sortable: true,
                  render: (item) => <span className="font-medium text-foreground">{item.name}</span>
                },
                {
                  key: "email",
                  label: "Email",
                  sortable: true,
                  render: (item) => <span className="text-sm text-muted-foreground">{item.email ?? "-"}</span>
                },
                {
                  key: "phone",
                  label: "Telephone",
                  render: (item) => <span className="text-sm text-muted-foreground">{item.phone ?? "-"}</span>
                },
                {
                  key: "productsCount",
                  label: "Produits",
                  sortable: true,
                  align: "right",
                  render: (item) => formatNumber(item.productsCount)
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
              getMobileDescription={(item) => item.email ?? "Sans email"}
              getMobileMeta={(item) => (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{item.phone ?? "Sans telephone"}</p>
                  <p>{formatNumber(item.productsCount)} produit(s) rattache(s)</p>
                </div>
              )}
              emptyTitle="Aucun fournisseur"
              emptyDescription="Aucun fournisseur ne correspond a la recherche courante."
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
