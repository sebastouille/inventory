"use client";

import type {
  OrganizationCurrentResponse,
  SpatialNodeIconKey,
  UpdateOrganizationSettingsInput
} from "@inventory/shared";
import {
  buildDefaultOrganizationSettings,
  SPATIAL_NODE_ICON_KEYS,
  SPATIAL_NODE_ICON_LABELS,
  SPATIAL_NODE_TYPES
} from "@inventory/shared";
import {
  Button,
  Field,
  FormSection,
  Input,
  ReadOnlyField,
  ReadOnlyFormPage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SpatialNodeChip
} from "@inventory/ui";
import { SaveIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function SettingsPage() {
  const token = useStoredToken();
  const [organization, setOrganization] = useState<OrganizationCurrentResponse | null>(null);
  const [form, setForm] = useState(buildDefaultOrganizationSettings());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const response = await apiFetch<OrganizationCurrentResponse>("/organizations/current");
        if (cancelled) {
          return;
        }
        setOrganization(response);
        setForm(response.settings);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les parametres");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const previewSettings = useMemo(
    () => form,
    [form]
  );

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <ReadOnlyFormPage
        eyebrow="Administration IAM"
        title="Parametres"
        description="Configuration locale du workspace et conventions visuelles du referentiel spatial."
        sections={
          <>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
            <FormSection title="Ports locaux" description="Valeurs de reference pour le developpement.">
              <ReadOnlyField label="Web" value="http://localhost:3010" />
              <ReadOnlyField label="API" value="http://localhost:3011/api/v1" />
              <ReadOnlyField label="Admin" value="http://localhost:3014" />
              <ReadOnlyField label="PostgreSQL" value="127.0.0.1:5560" />
            </FormSection>
            <FormSection title="Conventions UI" description="Regles retenues pour cette premiere vague.">
              <ReadOnlyField label="Theme de reference" value="Light en priorite, dark a parite" />
              <ReadOnlyField label="Typographie" value="Manrope, Sora, Geist Mono" />
              <ReadOnlyField label="Export listes" value="ODS uniquement dans cette vague" />
              <ReadOnlyField label="Mobile" value="PWA responsive sans offline actif" />
            </FormSection>
            <FormSection
              title="Styles spatiaux"
              description="Choix des couleurs et icones affiches pour chaque type de noeud spatial."
              columns={1}
            >
              <ReadOnlyField label="Organisation" value={organization?.name ?? "n/a"} />
              {SPATIAL_NODE_TYPES.map((type) => (
                <div key={type} className="rounded-2xl border border-border/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <SpatialNodeChip type={type} label={type} settings={previewSettings} />
                    <span className="text-sm text-muted-foreground">Apercu du type {type}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={`Icone ${type}`}>
                      <Select
                        value={form.spatialDisplay.nodeTypes[type].icon}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            spatialDisplay: {
                              ...current.spatialDisplay,
                              nodeTypes: {
                                ...current.spatialDisplay.nodeTypes,
                                [type]: {
                                  ...current.spatialDisplay.nodeTypes[type],
                                  icon: value as SpatialNodeIconKey
                                }
                              }
                            }
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPATIAL_NODE_ICON_KEYS.map((iconKey) => (
                            <SelectItem key={iconKey} value={iconKey}>
                              {SPATIAL_NODE_ICON_LABELS[iconKey]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={`Couleur ${type}`}>
                      <Input
                        value={form.spatialDisplay.nodeTypes[type].color}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            spatialDisplay: {
                              ...current.spatialDisplay,
                              nodeTypes: {
                                ...current.spatialDisplay.nodeTypes,
                                [type]: {
                                  ...current.spatialDisplay.nodeTypes[type],
                                  color: event.target.value.toUpperCase()
                                }
                              }
                            }
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Politique IAM spatiale</h3>
                  <p className="text-sm text-muted-foreground">
                    Scopes = restrictions spatiales explicites. Toute l organisation = les scopes restent enregistres
                    mais sont ignores pour l acces effectif.
                  </p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Mode de perimetre">
                    <Select
                      value={form.iam.spatialScopePolicy}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          iam: {
                            ...current.iam,
                            spatialScopePolicy: value as UpdateOrganizationSettingsInput["iam"]["spatialScopePolicy"]
                          }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SCOPED">Perimetres scopes</SelectItem>
                        <SelectItem value="ORGANIZATION_WIDE">Toute l organisation</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <ReadOnlyField
                    label="Mode courant"
                    value={
                      form.iam.spatialScopePolicy === "ORGANIZATION_WIDE"
                        ? "Toute l organisation"
                        : "Perimetres scopes"
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setError(null);
                    setSuccess(null);
                    try {
                      const payload: UpdateOrganizationSettingsInput = form;
                      const response = await apiFetch<OrganizationCurrentResponse>(
                        "/organizations/current/settings",
                        {
                          method: "PATCH",
                          body: JSON.stringify(payload)
                        }
                      );
                      setOrganization(response);
                      setForm(response.settings);
                      setSuccess("Parametres enregistres");
                    } catch (submitError) {
                      if (isUnauthorizedApiError(submitError)) {
                        setError(null);
                        return;
                      }
                      setError(
                        submitError instanceof Error
                          ? submitError.message
                          : "Impossible d enregistrer les parametres"
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  <SaveIcon className="size-4" />
                  Enregistrer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const settings = organization?.settings ?? buildDefaultOrganizationSettings();
                    setForm(settings);
                    setSuccess(null);
                    setError(null);
                  }}
                >
                  Reinitialiser
                </Button>
              </div>
            </FormSection>
          </>
        }
      />
    </AdminShell>
  );
}
