"use client";

import type { InventoryOverviewResponse } from "@inventory/shared";
import { formatDateTime, formatNumber } from "@inventory/shared";
import { DashboardPage, DataGrid, MetricCard, PageSection } from "@inventory/ui";
import { AlertTriangleIcon, BoxesIcon, PackageOpenIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MovementTypeBadge } from "@/components/movement-type-badge";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function InventoryPage() {
  const token = useStoredToken();
  const [overview, setOverview] = useState<InventoryOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return apiFetch<InventoryOverviewResponse>("/inventory/overview");
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const response = await loadData();
        if (cancelled) {
          return;
        }
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setOverview(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la vue inventaire");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <DashboardPage
        eyebrow="Inventaire"
        title="Vue terrain"
        description="Vue compacte orientee exceptions de stock et mouvements les plus recents."
        metrics={
          <>
            <MetricCard
              label="Alertes stock"
              value={formatNumber(overview?.metrics.lowStockCount ?? 0)}
              hint="Biens a verifier"
              icon={<AlertTriangleIcon className="size-5" />}
            />
            <MetricCard
              label="Unites"
              value={formatNumber(overview?.metrics.totalUnits ?? 0)}
              hint="Volume total en stock"
              icon={<BoxesIcon className="size-5" />}
            />
            <MetricCard
              label="Biens suivis"
              value={formatNumber(overview?.metrics.products ?? 0)}
              hint="Articles actifs"
              icon={<PackageOpenIcon className="size-5" />}
            />
          </>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <PageSection title="Queue des alertes" description="Priorites a traiter en premier sur le terrain.">
          <DataGrid
            rows={overview?.lowStock ?? []}
            columns={[
              {
                key: "name",
                label: "Bien",
                render: (item) => (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                )
              },
              {
                key: "quantity",
                label: "Stock",
                align: "right",
                render: (item) => formatNumber(item.quantity)
              },
              {
                key: "minStock",
                label: "Seuil",
                align: "right",
                render: (item) => formatNumber(item.minStock)
              }
            ]}
            getRowId={(item) => item.id}
            getMobileTitle={(item) => item.name}
            getMobileDescription={(item) => item.sku}
            getMobileMeta={(item) => (
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Stock {formatNumber(item.quantity)}</span>
                <span>Seuil {formatNumber(item.minStock)}</span>
              </div>
            )}
            emptyTitle="Aucune anomalie de stock"
            emptyDescription="Aucun bien n est actuellement sous son seuil minimal."
          />
        </PageSection>

        <PageSection title="Derniers mouvements" description="Controle rapide des dernieres ecritures.">
          <DataGrid
            rows={overview?.recentMovements ?? []}
            columns={[
              {
                key: "product",
                label: "Produit",
                render: (movement) => (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{movement.product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{movement.product.sku}</p>
                  </div>
                )
              },
              {
                key: "type",
                label: "Type",
                render: (movement) => <MovementTypeBadge type={movement.type} />
              },
              {
                key: "quantity",
                label: "Quantite",
                align: "right",
                render: (movement) => formatNumber(movement.quantity)
              },
              {
                key: "createdAt",
                label: "Date",
                render: (movement) => (
                  <span className="text-sm text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
                )
              }
            ]}
            getRowId={(movement) => movement.id}
            getMobileTitle={(movement) => movement.product.name}
            getMobileDescription={(movement) => movement.product.sku}
            getMobileMeta={(movement) => (
              <div className="flex flex-wrap items-center gap-2">
                <MovementTypeBadge type={movement.type} />
                <span className="text-sm text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
              </div>
            )}
            emptyTitle="Aucun mouvement recent"
            emptyDescription="Aucun mouvement recent n est disponible pour le tenant courant."
          />
        </PageSection>
      </DashboardPage>
    </AppShell>
  );
}
