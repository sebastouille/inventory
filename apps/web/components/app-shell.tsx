"use client";

import type {
  AssetListItem,
  DashboardOverviewResponse,
  EquipmentMovementSummary,
  ImmobilizationSummary,
  PaginatedResponse,
  SpatialNodeListItem
} from "@inventory/shared";
import { AppShell as SharedAppShell, type AppNavGroup, type AppShellHelpDialog } from "@inventory/ui";
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  CuboidIcon,
  ClipboardListIcon,
  FolderInputIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LaptopMinimalIcon,
  MapPinnedIcon,
  ScanBarcodeIcon,
  Settings2Icon,
  ShieldIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { apiFetch, clearStoredToken } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

interface AppShellProps {
  children: React.ReactNode;
  helpDialog?: AppShellHelpDialog | null;
}

export function AppShell({ children, helpDialog }: AppShellProps) {
  const router = useRouter();
  const token = useStoredToken();
  const globalSearch = useGlobalSearch();
  const [navGroups, setNavGroups] = useState<AppNavGroup[]>([
    {
      label: "Pilotage",
      items: [
        { href: "/", label: "Tableau de bord", icon: <LayoutDashboardIcon className="size-4" /> },
        { href: "/campaigns", label: "Campagnes", icon: <ClipboardListIcon className="size-4" /> },
        { href: "/anomalies", label: "Anomalies", icon: <AlertTriangleIcon className="size-4" /> }
      ]
    },
    {
      label: "Referentiel",
      items: [
        { href: "/locations", label: "Localisations", icon: <MapPinnedIcon className="size-4" /> },
        { href: "/spatial-3d", label: "Carte 3D", icon: <CuboidIcon className="size-4" /> },
        { href: "/assets", label: "Equipements", icon: <LaptopMinimalIcon className="size-4" /> },
        { href: "/immobilizations", label: "Immobilisations", icon: <LandmarkIcon className="size-4" /> },
        { href: "/labels", label: "Etiquettes", icon: <ScanBarcodeIcon className="size-4" /> }
      ]
    },
    {
      label: "Flux",
      items: [
        { href: "/equipment-movements", label: "Mouvements equipements", icon: <ArrowRightLeftIcon className="size-4" /> },
        { href: "/imports", label: "Imports et exports", icon: <FolderInputIcon className="size-4" /> },
        { href: "/reconciliation", label: "Rapprochement", icon: <LandmarkIcon className="size-4" /> },
        { href: "/audit", label: "Audit", icon: <ShieldIcon className="size-4" /> }
      ]
    },
    {
      label: "Espace",
      items: [{ href: "/settings", label: "Parametres", icon: <Settings2Icon className="size-4" /> }]
    }
  ]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      apiFetch<PaginatedResponse<AssetListItem>>("/assets?page=1&pageSize=10"),
      apiFetch<PaginatedResponse<ImmobilizationSummary>>("/immobilizations?page=1&pageSize=10"),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>("/spatial/nodes?page=1&pageSize=10"),
      apiFetch<PaginatedResponse<EquipmentMovementSummary>>("/equipment-movements?page=1&pageSize=10"),
      apiFetch<DashboardOverviewResponse>("/dashboard/overview")
    ])
      .then(([assets, immobilizations, locations, equipmentMovements, overview]) => {
        if (cancelled) return;
        setNavGroups([
          {
            label: "Pilotage",
            items: [
              { href: "/", label: "Tableau de bord", icon: <LayoutDashboardIcon className="size-4" /> },
              {
                href: "/campaigns",
                label: "Campagnes",
                icon: <ClipboardListIcon className="size-4" />,
                badge: overview.metrics.openCampaignsCount
              },
              {
                href: "/anomalies",
                label: "Anomalies",
                icon: <AlertTriangleIcon className="size-4" />,
                badge: overview.metrics.openAnomaliesCount
              }
            ]
          },
          {
            label: "Referentiel",
            items: [
              {
                href: "/locations",
                label: "Localisations",
                icon: <MapPinnedIcon className="size-4" />,
                badge: locations.total
              },
              {
                href: "/spatial-3d",
                label: "Carte 3D",
                icon: <CuboidIcon className="size-4" />,
                badge: locations.total
              },
              {
                href: "/assets",
                label: "Equipements",
                icon: <LaptopMinimalIcon className="size-4" />,
                badge: assets.total
              },
              {
                href: "/immobilizations",
                label: "Immobilisations",
                icon: <LandmarkIcon className="size-4" />,
                badge: immobilizations.total
              },
              {
                href: "/labels",
                label: "Etiquettes",
                icon: <ScanBarcodeIcon className="size-4" />
              }
            ]
          },
          {
            label: "Flux",
            items: [
              {
                href: "/equipment-movements",
                label: "Mouvements equipements",
                icon: <ArrowRightLeftIcon className="size-4" />,
                badge: equipmentMovements.total
              },
              { href: "/imports", label: "Imports et exports", icon: <FolderInputIcon className="size-4" /> },
              { href: "/reconciliation", label: "Rapprochement", icon: <LandmarkIcon className="size-4" /> },
              { href: "/audit", label: "Audit", icon: <ShieldIcon className="size-4" /> }
            ]
          },
          {
            label: "Espace",
            items: [
              {
                href: "/settings",
                label: "Parametres",
                icon: <Settings2Icon className="size-4" />
              }
            ]
          }
        ]);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <SharedAppShell
      brandEyebrow="INVENTAIRE"
      brandName="Physique & rapprochement comptable"
      navGroups={navGroups}
      helpDialog={helpDialog}
      onLogout={() => {
        clearStoredToken();
        window.location.reload();
      }}
      globalSearch={{
        value: globalSearch.value,
        onValueChange: globalSearch.setValue,
        results: globalSearch.results,
        isLoading: globalSearch.isLoading,
        error: globalSearch.error,
        minChars: globalSearch.minChars,
        placeholder: "Recherche globale",
        onSelect: (item) => {
          globalSearch.clear();
          router.push(item.href);
        }
      }}
    >
      {children}
    </SharedAppShell>
  );
}
