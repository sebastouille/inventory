"use client";

import type { ApiHealthResponse, CurrentUserResponse, IamRoleDetail, IamUserListItem, PaginatedResponse } from "@inventory/shared";
import { AppShell as SharedAppShell, type AppNavGroup } from "@inventory/ui";
import {
  ActivityIcon,
  BoxesIcon,
  Building2Icon,
  FolderInputIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersRoundIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { apiFetch, clearStoredToken, fetchApiHealth } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const token = useStoredToken();
  const globalSearch = useGlobalSearch();
  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [navGroups, setNavGroups] = useState<AppNavGroup[]>([
    {
      label: "Pilotage",
      items: [
        { href: "/", label: "Tableau de bord", icon: <LayoutDashboardIcon className="size-4" /> },
        { href: "/organizations", label: "Organisation", icon: <Building2Icon className="size-4" /> }
      ]
    },
    {
      label: "Habilitations",
      items: [
        { href: "/users", label: "Utilisateurs", icon: <UsersRoundIcon className="size-4" /> },
        { href: "/roles", label: "Roles et permissions", icon: <ShieldCheckIcon className="size-4" /> }
      ]
    },
    {
      label: "Referentiels",
      items: [{ href: "/assets-references", label: "References assets", icon: <BoxesIcon className="size-4" /> }]
    },
    {
      label: "Parametres",
      items: [{ href: "/settings", label: "Parametres", icon: <Settings2Icon className="size-4" /> }]
    }
  ]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      apiFetch<PaginatedResponse<IamUserListItem>>("/iam/users?page=1&pageSize=10"),
      apiFetch<PaginatedResponse<IamRoleDetail>>("/iam/roles?page=1&pageSize=10"),
      apiFetch<CurrentUserResponse>("/auth/me")
    ])
      .then(([users, roles, me]) => {
        if (cancelled) return;
        setNavGroups([
          {
            label: "Pilotage",
            items: [
              { href: "/", label: "Tableau de bord", icon: <LayoutDashboardIcon className="size-4" /> },
              {
                href: "/organizations",
                label: "Organisation",
                icon: <Building2Icon className="size-4" />,
                badge: 1
              }
            ]
          },
          {
            label: "Habilitations",
            items: [
              {
                href: "/users",
                label: "Utilisateurs",
                icon: <UsersRoundIcon className="size-4" />,
                badge: users.total
              },
              {
                href: "/roles",
                label: "Roles et permissions",
                icon: <ShieldCheckIcon className="size-4" />,
                badge: roles.total
              }
            ]
          },
          {
            label: "Referentiels",
            items: [
              {
                href: "/assets-references",
                label: "References assets",
                icon: <BoxesIcon className="size-4" />
              },
              {
                href: "/spatial",
                label: "Referentiel spatial",
                icon: <FolderInputIcon className="size-4" />
              }
            ]
          },
          {
            label: "Parametres",
            items: [
              {
                href: "/settings",
                label: me.primaryRoleLabel ? `Parametres ${me.primaryRoleLabel}` : "Parametres",
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

  useEffect(() => {
    let cancelled = false;

    const refreshHealth = async () => {
      try {
        const nextHealth = await fetchApiHealth();
        if (cancelled) {
          return;
        }
        setHealth(nextHealth);
        setHealthError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "API indisponible ou inaccessible");
      }
    };

    void refreshHealth();
    const interval = window.setInterval(() => {
      void refreshHealth();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const healthTone =
    health?.status === "ok" ? "ok" : health?.status === "degraded" ? "degraded" : "down";
  const healthLabel =
    healthTone === "ok"
      ? "API OK"
      : healthTone === "degraded"
        ? "API degradee"
        : "API indisponible";
  const healthDetails = health
    ? `${healthLabel} - base ${health.database === "up" ? "OK" : "indisponible"} - ${new Date(health.timestamp).toLocaleTimeString("fr-FR")}`
    : healthError ?? "Verification API en cours";

  return (
    <SharedAppShell
      brandEyebrow="INVENTAIRE"
      brandName="Physique & rapprochement comptable"
      navGroups={navGroups}
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
          window.location.assign(item.href);
        }
      }}
      headerStatus={{
        content: (
          <div
            className={
              healthTone === "ok"
                ? "inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700"
                : healthTone === "degraded"
                  ? "inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700"
                  : "inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700"
            }
            title={healthDetails}
            aria-label={healthDetails}
          >
            <ActivityIcon className="size-4" />
            <span className="hidden sm:inline">{healthLabel}</span>
            <span
              className={
                healthTone === "ok"
                  ? "size-2 rounded-full bg-emerald-600"
                  : healthTone === "degraded"
                    ? "size-2 rounded-full bg-amber-600"
                    : "size-2 rounded-full bg-red-600"
              }
            />
          </div>
        )
      }}
    >
      {children}
    </SharedAppShell>
  );
}
