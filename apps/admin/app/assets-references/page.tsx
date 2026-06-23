"use client";

import type {
  AttachmentRuleItem,
  EquipmentReferenceItem,
  EquipmentReferenceResource
} from "@inventory/shared";
import { formatNumber } from "@inventory/shared";
import {
  Button,
  DataGrid,
  Field,
  FilterBar,
  FormSection,
  Input,
  ListPage,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { ArchiveIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

type StandardReferenceResource = Exclude<EquipmentReferenceResource, "attachment-rules">;

type ParentOptions = {
  categories: EquipmentReferenceItem[];
  families: EquipmentReferenceItem[];
  subfamilies: EquipmentReferenceItem[];
  brands: EquipmentReferenceItem[];
};

const RESOURCE_OPTIONS: Array<{ value: EquipmentReferenceResource; label: string }> = [
  { value: "categories", label: "Categories" },
  { value: "families", label: "Familles" },
  { value: "subfamilies", label: "Sous-familles" },
  { value: "types", label: "Types" },
  { value: "brands", label: "Marques" },
  { value: "models", label: "Modeles" },
  { value: "statuses", label: "Statuts" },
  { value: "owners", label: "Proprietaires" },
  { value: "attachment-rules", label: "Regles de rattachement" }
];

const STANDARD_RESOURCE_SET = new Set<EquipmentReferenceResource>([
  "categories",
  "families",
  "subfamilies",
  "types",
  "brands",
  "models",
  "statuses",
  "owners"
]);

const PARENT_RESOURCE: Partial<Record<StandardReferenceResource, keyof ParentOptions>> = {
  families: "categories",
  subfamilies: "families",
  types: "subfamilies",
  models: "brands"
};

const emptyStandardForm = {
  id: null as string | null,
  code: "",
  label: "",
  description: "",
  parentId: "none",
  isGeneric: "false" as "true" | "false"
};

const emptyRuleForm = {
  id: null as string | null,
  sourceFamilyId: "none",
  targetFamilyId: "none"
};

function isStandardResource(resource: EquipmentReferenceResource): resource is StandardReferenceResource {
  return STANDARD_RESOURCE_SET.has(resource);
}

export default function AssetReferencesPage() {
  const token = useStoredToken();
  const [resource, setResource] = useState<EquipmentReferenceResource>("categories");
  const [references, setReferences] = useState<EquipmentReferenceItem[]>([]);
  const [rules, setRules] = useState<AttachmentRuleItem[]>([]);
  const [parents, setParents] = useState<ParentOptions>({
    categories: [],
    families: [],
    subfamilies: [],
    brands: []
  });
  const [query, setQuery] = useState({
    q: "",
    state: "all" as "all" | "active" | "inactive"
  });
  const [standardForm, setStandardForm] = useState(emptyStandardForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const selectedResourceLabel = RESOURCE_OPTIONS.find((item) => item.value === resource)?.label ?? resource;

  const resetForms = () => {
    setStandardForm(emptyStandardForm);
    setRuleForm(emptyRuleForm);
    setSubmitError(null);
  };

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    const queryString = buildQueryString({
      q: query.q || undefined,
      state: query.state
    });

    const [current, categories, families, subfamilies, brands] = await Promise.all([
      apiFetch<EquipmentReferenceItem[] | AttachmentRuleItem[]>(`/assets/references/${resource}${queryString}`),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/categories?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/families?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/subfamilies?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/brands?state=active")
    ]);

    return {
      current,
      parents: {
        categories,
        families,
        subfamilies,
        brands
      }
    };
  }, [query.q, query.state, resource, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { current, parents: parentOptions } = await loadData();
        if (cancelled) {
          return;
        }
        setParents(parentOptions);
        if (resource === "attachment-rules") {
          setRules(current as AttachmentRuleItem[]);
          setReferences([]);
        } else {
          setReferences(current as EquipmentReferenceItem[]);
          setRules([]);
        }
        setLoadError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(error)) {
          setLoadError(null);
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Impossible de charger les references assets");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, resource, token]);

  const parentOptions = useMemo(() => {
    if (!isStandardResource(resource)) {
      return [];
    }
    const parentKey = PARENT_RESOURCE[resource];
    return parentKey ? parents[parentKey] : [];
  }, [parents, resource]);

  const selectedParentLabel = useMemo(() => {
    if (standardForm.parentId === "none") {
      return "";
    }
    return parentOptions.find((item) => item.id === standardForm.parentId)?.label ?? "";
  }, [parentOptions, standardForm.parentId]);

  const selectedSourceFamilyLabel = useMemo(() => {
    if (ruleForm.sourceFamilyId === "none") {
      return "";
    }
    return parents.families.find((item) => item.id === ruleForm.sourceFamilyId)?.label ?? "";
  }, [parents.families, ruleForm.sourceFamilyId]);

  const selectedTargetFamilyLabel = useMemo(() => {
    if (ruleForm.targetFamilyId === "none") {
      return "";
    }
    return parents.families.find((item) => item.id === ruleForm.targetFamilyId)?.label ?? "";
  }, [parents.families, ruleForm.targetFamilyId]);

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <ListPage
        eyebrow="Administration assets"
        title="References assets"
        description="Administration des referentiels categories, familles, types, modeles, statuts, proprietaires et regles de rattachement."
        filters={
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {RESOURCE_OPTIONS.map((item) => (
                <Button
                  key={item.value}
                  variant={item.value === resource ? "default" : "outline"}
                  onClick={() => {
                    setResource(item.value);
                    setQuery({ q: "", state: "all" });
                    resetForms();
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <FilterBar
              searchValue={query.q}
              onSearchChange={(value) => setQuery((current) => ({ ...current, q: value }))}
              searchPlaceholder={`Rechercher dans ${selectedResourceLabel.toLowerCase()}`}
              filters={
                <Select
                  value={query.state}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, state: (value as typeof current.state) ?? "all" }))
                  }
                >
                  <SelectTrigger className="min-w-44">
                    <SelectValue placeholder="Tous les etats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les etats</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="inactive">Inactifs</SelectItem>
                  </SelectContent>
                </Select>
              }
              actions={
                <Button variant="outline" onClick={() => void loadData().then(({ current, parents: parentOptions }) => {
                  setParents(parentOptions);
                  if (resource === "attachment-rules") {
                    setRules(current as AttachmentRuleItem[]);
                    setReferences([]);
                  } else {
                    setReferences(current as EquipmentReferenceItem[]);
                    setRules([]);
                  }
                  setLoadError(null);
                }).catch((error) => {
                  if (isUnauthorizedApiError(error)) {
                    setLoadError(null);
                    return;
                  }
                  setLoadError(error instanceof Error ? error.message : "Impossible de charger les references assets");
                })}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
              }
            />
          </div>
        }
        grid={
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <PageSection
              title={selectedResourceLabel}
              description={`${formatNumber(resource === "attachment-rules" ? rules.length : references.length)} enregistrement(s) visible(s).`}
            >
              {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

              {resource === "attachment-rules" ? (
                <DataGrid
                  rows={rules}
                  columns={[
                    {
                      key: "source",
                      label: "Famille source",
                      render: (item) => item.sourceFamilyLabel
                    },
                    {
                      key: "target",
                      label: "Famille cible",
                      render: (item) => item.targetFamilyLabel
                    },
                    {
                      key: "status",
                      label: "Etat",
                      render: (item) => (
                        <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Actif" : "Inactif"} />
                      )
                    }
                  ]}
                  getRowId={(item) => item.id}
                  getMobileTitle={(item) => item.sourceFamilyLabel}
                  getMobileDescription={(item) => `Vers ${item.targetFamilyLabel}`}
                  getMobileMeta={(item) => (
                    <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Actif" : "Inactif"} />
                  )}
                  rowActions={[
                    {
                      label: "Modifier",
                      onClick: (item) =>
                        setRuleForm({
                          id: item.id,
                          sourceFamilyId: item.sourceFamilyId,
                          targetFamilyId: item.targetFamilyId
                        })
                    }
                  ]}
                  emptyTitle="Aucune regle"
                  emptyDescription="Aucune regle de rattachement ne correspond au filtre courant."
                />
              ) : (
                <DataGrid
                  rows={references}
                  columns={[
                    {
                      key: "label",
                      label: "Libelle",
                      render: (item) => (
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">{item.code}</p>
                        </div>
                      )
                    },
                    {
                      key: "parent",
                      label: "Parent",
                      render: (item) => item.parentLabel ?? "-"
                    },
                    {
                      key: "generic",
                      label: "Generique",
                      render: (item) =>
                        resource === "models" ? (
                          <StatusBadge status={item.isGeneric ? "neutral" : "inactive"} label={item.isGeneric ? "Oui" : "Non"} />
                        ) : (
                          "-"
                        )
                    },
                    {
                      key: "status",
                      label: "Etat",
                      render: (item) => (
                        <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Actif" : "Inactif"} />
                      )
                    }
                  ]}
                  getRowId={(item) => item.id}
                  getMobileTitle={(item) => item.label}
                  getMobileDescription={(item) => item.code}
                  getMobileMeta={(item) => (
                    <div className="space-y-2.5">
                      {item.parentLabel ? <p className="text-sm text-muted-foreground">{item.parentLabel}</p> : null}
                      <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Actif" : "Inactif"} />
                    </div>
                  )}
                  rowActions={[
                    {
                      label: "Modifier",
                      onClick: (item) =>
                        setStandardForm({
                          id: item.id,
                          code: item.code,
                          label: item.label,
                          description: item.description ?? "",
                          parentId: item.parentId ?? "none",
                          isGeneric: item.isGeneric ? "true" : "false"
                        })
                    }
                  ]}
                  emptyTitle="Aucune reference"
                  emptyDescription="Aucune reference ne correspond au filtre courant."
                />
              )}
            </PageSection>

            <PageSection
              title={resource === "attachment-rules" ? "Editer une regle" : "Editer une reference"}
              description={resource === "attachment-rules" ? "Creation, modification et archivage des compatibilites de rattachement." : "Creation, modification et archivage des referentiels actifs."}
            >
              <div className="space-y-4">
                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

                {resource === "attachment-rules" ? (
                  <>
                    <FormSection title="Regle" description="Definir la compatibilite entre famille source et famille cible." columns={1}>
                      <Field label="Famille source">
                        <Select
                          value={ruleForm.sourceFamilyId}
                          onValueChange={(value) => setRuleForm((current) => ({ ...current, sourceFamilyId: value ?? "none" }))}
                        >
                          <SelectTrigger>
                            <span className={selectedSourceFamilyLabel ? "flex-1 text-left" : "flex-1 text-left text-muted-foreground"}>
                              {selectedSourceFamilyLabel || "Choisir une famille source"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Choisir une famille source</SelectItem>
                            {parents.families.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Famille cible">
                        <Select
                          value={ruleForm.targetFamilyId}
                          onValueChange={(value) => setRuleForm((current) => ({ ...current, targetFamilyId: value ?? "none" }))}
                        >
                          <SelectTrigger>
                            <span className={selectedTargetFamilyLabel ? "flex-1 text-left" : "flex-1 text-left text-muted-foreground"}>
                              {selectedTargetFamilyLabel || "Choisir une famille cible"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Choisir une famille cible</SelectItem>
                            {parents.families.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </FormSection>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          setSubmitError(null);
                          try {
                            const payload = {
                              sourceFamilyId: ruleForm.sourceFamilyId === "none" ? "" : ruleForm.sourceFamilyId,
                              targetFamilyId: ruleForm.targetFamilyId === "none" ? "" : ruleForm.targetFamilyId
                            };
                            if (ruleForm.id) {
                              await apiFetch(`/assets/references/attachment-rules/${ruleForm.id}`, {
                                method: "PATCH",
                                body: JSON.stringify(payload)
                              });
                            } else {
                              await apiFetch("/assets/references/attachment-rules", {
                                method: "POST",
                                body: JSON.stringify(payload)
                              });
                            }
                            resetForms();
                            const { current, parents: parentOptions } = await loadData();
                            setParents(parentOptions);
                            setRules(current as AttachmentRuleItem[]);
                          } catch (error) {
                            if (isUnauthorizedApiError(error)) {
                              setSubmitError(null);
                              return;
                            }
                            setSubmitError(error instanceof Error ? error.message : "Impossible d enregistrer la regle");
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      >
                        <SaveIcon className="size-4" />
                        {submitting ? "Enregistrement..." : ruleForm.id ? "Enregistrer" : "Creer la regle"}
                      </Button>
                      <Button variant="ghost" onClick={() => resetForms()}>
                        Annuler
                      </Button>
                      {ruleForm.id ? (
                        <Button
                          variant="destructive"
                          disabled={archivingId === ruleForm.id}
                          onClick={async () => {
                            setArchivingId(ruleForm.id);
                            setSubmitError(null);
                            try {
                              await apiFetch(`/assets/references/attachment-rules/${ruleForm.id}/archive`, { method: "POST" });
                              resetForms();
                              const { current, parents: parentOptions } = await loadData();
                              setParents(parentOptions);
                              setRules(current as AttachmentRuleItem[]);
                            } catch (error) {
                              if (isUnauthorizedApiError(error)) {
                                setSubmitError(null);
                                return;
                              }
                              setSubmitError(error instanceof Error ? error.message : "Impossible d archiver la regle");
                            } finally {
                              setArchivingId(null);
                            }
                          }}
                        >
                          <ArchiveIcon className="size-4" />
                          Archiver
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <FormSection title={selectedResourceLabel} description="Champs standards de reference." columns={1}>
                      <Field label="Code">
                        <Input
                          value={standardForm.code}
                          onChange={(event) => setStandardForm((current) => ({ ...current, code: event.target.value }))}
                        />
                      </Field>
                      <Field label="Libelle">
                        <Input
                          value={standardForm.label}
                          onChange={(event) => setStandardForm((current) => ({ ...current, label: event.target.value }))}
                        />
                      </Field>
                      <Field label="Description">
                        <Input
                          value={standardForm.description}
                          onChange={(event) => setStandardForm((current) => ({ ...current, description: event.target.value }))}
                        />
                      </Field>
                      {parentOptions.length > 0 ? (
                        <Field label="Parent">
                          <Select
                            value={standardForm.parentId}
                            onValueChange={(value) => setStandardForm((current) => ({ ...current, parentId: value ?? "none" }))}
                          >
                            <SelectTrigger>
                              <span className={selectedParentLabel ? "flex-1 text-left" : "flex-1 text-left text-muted-foreground"}>
                                {selectedParentLabel || "Choisir un parent"}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Choisir un parent</SelectItem>
                              {parentOptions.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : null}
                      {resource === "models" ? (
                        <Field label="Modele generique">
                          <Select
                            value={standardForm.isGeneric}
                            onValueChange={(value) =>
                              setStandardForm((current) => ({ ...current, isGeneric: (value as "true" | "false") ?? "false" }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">Non</SelectItem>
                              <SelectItem value="true">Oui</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : null}
                    </FormSection>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={submitting}
                        onClick={async () => {
                          if (!isStandardResource(resource)) {
                            return;
                          }
                          setSubmitting(true);
                          setSubmitError(null);
                          try {
                            const payload = {
                              code: standardForm.code,
                              label: standardForm.label,
                              description: standardForm.description || null,
                              parentId: parentOptions.length > 0 && standardForm.parentId !== "none" ? standardForm.parentId : null,
                              isGeneric: resource === "models" ? standardForm.isGeneric === "true" : undefined
                            };
                            if (standardForm.id) {
                              await apiFetch(`/assets/references/${resource}/${standardForm.id}`, {
                                method: "PATCH",
                                body: JSON.stringify(payload)
                              });
                            } else {
                              await apiFetch(`/assets/references/${resource}`, {
                                method: "POST",
                                body: JSON.stringify(payload)
                              });
                            }
                            resetForms();
                            const { current, parents: parentOptionsResponse } = await loadData();
                            setParents(parentOptionsResponse);
                            setReferences(current as EquipmentReferenceItem[]);
                          } catch (error) {
                            if (isUnauthorizedApiError(error)) {
                              setSubmitError(null);
                              return;
                            }
                            setSubmitError(error instanceof Error ? error.message : "Impossible d enregistrer la reference");
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      >
                        <SaveIcon className="size-4" />
                        {submitting ? "Enregistrement..." : standardForm.id ? "Enregistrer" : "Creer la reference"}
                      </Button>
                      <Button variant="ghost" onClick={() => resetForms()}>
                        Annuler
                      </Button>
                      {standardForm.id ? (
                        <Button
                          variant="destructive"
                          disabled={archivingId === standardForm.id}
                          onClick={async () => {
                            if (!isStandardResource(resource)) {
                              return;
                            }
                            setArchivingId(standardForm.id);
                            setSubmitError(null);
                            try {
                              await apiFetch(`/assets/references/${resource}/${standardForm.id}/archive`, { method: "POST" });
                              resetForms();
                              const { current, parents: parentOptionsResponse } = await loadData();
                              setParents(parentOptionsResponse);
                              setReferences(current as EquipmentReferenceItem[]);
                            } catch (error) {
                              if (isUnauthorizedApiError(error)) {
                                setSubmitError(null);
                                return;
                              }
                              setSubmitError(error instanceof Error ? error.message : "Impossible d archiver la reference");
                            } finally {
                              setArchivingId(null);
                            }
                          }}
                        >
                          <ArchiveIcon className="size-4" />
                          Archiver
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </PageSection>
          </div>
        }
        pagination={
          <PageSection title="Couverture" description="Perimetre de la vague assets V1.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ressource active</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{selectedResourceLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Objets visibles</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatNumber(resource === "attachment-rules" ? rules.length : references.length)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workflow</p>
                <p className="mt-2 text-lg font-semibold text-foreground">CRUD + archivage logique</p>
              </div>
            </div>
          </PageSection>
        }
      />
    </AdminShell>
  );
}
