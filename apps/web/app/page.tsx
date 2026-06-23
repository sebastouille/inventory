"use client";

import type { DashboardOverviewResponse } from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import { DashboardPage, MetricCard } from "@inventory/ui";
import {
  AlertTriangleIcon,
  ClipboardListIcon,
  LandmarkIcon,
  ScanSearchIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function HomePage() {
  const router = useRouter();
  const token = useStoredToken();
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return apiFetch<DashboardOverviewResponse>("/dashboard/overview");
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
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le tableau de bord");
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
        eyebrow="Exploitation"
        title="Tableau de bord"
        metrics={
          <>
            <MetricCard
              label="Campagnes ouvertes"
              value={formatNumber(overview?.metrics.openCampaignsCount ?? 0)}
              hint="Campagnes terrain en cours"
              icon={<ClipboardListIcon className="size-5" />}
              onClick={() => router.push("/campaigns?status=OPEN")}
            />
            <MetricCard
              label="Anomalies ouvertes"
              value={formatNumber(overview?.metrics.openAnomaliesCount ?? 0)}
              hint="Ecarts en attente de resolution"
              icon={<AlertTriangleIcon className="size-5" />}
              onClick={() => router.push("/anomalies?status=OPEN")}
            />
            <MetricCard
              label="Immobilisations non rapprochees"
              value={formatNumber(overview?.metrics.unreconciledImmobilizationsCount ?? 0)}
              hint="Immobilisations actives sans equipement lie"
              icon={<LandmarkIcon className="size-5" />}
              onClick={() => router.push("/immobilizations")}
            />
            <MetricCard
              label="Biens non inventories depuis 12 mois"
              value={formatNumber(overview?.metrics.staleInventoryCount ?? 0)}
              hint="Biens jamais inventories ou inventaires trop anciens"
              icon={<ScanSearchIcon className="size-5" />}
              onClick={() => router.push("/assets")}
            />
          </>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DashboardPage>
    </AppShell>
  );
}
