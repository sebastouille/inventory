"use client";

import type { CurrentUserResponse, OrganizationCurrentResponse } from "@inventory/shared";
import { FormSection, ReadOnlyField, ReadOnlyFormPage } from "@inventory/ui";
import { useCallback, useEffect, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function OrganizationsPage() {
  const token = useStoredToken();
  const [organization, setOrganization] = useState<OrganizationCurrentResponse | null>(null);
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return Promise.all([
      apiFetch<OrganizationCurrentResponse>("/organizations/current"),
      apiFetch<CurrentUserResponse>("/auth/me")
    ]);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [organizationResponse, meResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setOrganization(organizationResponse);
        setMe(meResponse);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setOrganization(null);
          setMe(null);
          setError(null);
          return;
        }
        setOrganization(null);
        setMe(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger l organisation");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <ReadOnlyFormPage
        eyebrow="Administration IAM"
        title="Organisation"
        description="Contexte du tenant courant et rattachement de l operateur."
        sections={
          <>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <FormSection title="Tenant courant" description="Informations exposees par /api/v1/organizations/current.">
              <ReadOnlyField label="Nom" value={organization?.name ?? "Chargement"} />
              <ReadOnlyField label="Slug" value={organization?.slug ?? "Chargement"} />
              <ReadOnlyField label="Identifiant" value={organization?.id ?? "Chargement"} />
              <ReadOnlyField label="Operateur" value={me?.email ?? "Chargement"} />
              <ReadOnlyField
                label="Politique spatiale IAM"
                value={
                  organization?.settings.iam.spatialScopePolicy === "ORGANIZATION_WIDE"
                    ? "Toute l organisation"
                    : "Perimetres scopes"
                }
              />
            </FormSection>
            <FormSection title="Contexte de session" description="Informations derivees de /api/v1/auth/me.">
              <ReadOnlyField label="Utilisateur" value={me?.name ?? "-"} />
              <ReadOnlyField label="Role principal" value={me?.primaryRoleLabel ?? "-"} />
              <ReadOnlyField label="Permissions" value={me?.permissions.length ?? 0} />
              <ReadOnlyField label="Perimetres" value={me?.scopeAssignments.length ?? 0} />
              <ReadOnlyField
                label="Mode effectif"
                value={me?.isOrganizationWideSpatialAccess ? "Toute l organisation" : "Perimetres scopes"}
              />
            </FormSection>
          </>
        }
      />
    </AdminShell>
  );
}
