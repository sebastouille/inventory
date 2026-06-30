"use client";

import type {
  AssetAssignableUser,
  AssetAssignmentInput,
  AssetDetail,
  AssetHistoryEntry,
  AssetListItem,
  EquipmentMovementSummary,
  EquipmentReferenceItem,
  ImmobilizationSummary,
  PaginatedResponse,
  SpatialNodeListItem
} from "@inventory/shared";
import { formatDate, formatDateTime } from "@inventory/shared";
import {
  Button,
  EditFormPage,
  Field,
  FormSection,
  Input,
  PageSection,
  ReadOnlyField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea
} from "@inventory/ui";
import { ArchiveIcon, ArrowLeftIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AssetAssignmentEditor } from "@/components/assets/asset-assignment-editor";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

interface AssetEditorPageProps {
  assetId?: string;
}

interface AssetFormState {
  internalCode: string;
  numPiece: string;
  externalRef: string;
  serialNumber: string;
  equipmentTypeId: string;
  equipmentModelId: string;
  equipmentStatusId: string;
  ownerEntityId: string;
  currentSpatialNodeId: string;
  immobilizationId: string;
  technicalCharacteristics: string;
  notes: string;
  receivedAt: string;
  commissionedAt: string;
  lastInventoryAt: string;
  assignments: AssetAssignmentInput[];
}

const emptyForm: AssetFormState = {
  internalCode: "",
  numPiece: "",
  externalRef: "",
  serialNumber: "",
  equipmentTypeId: "",
  equipmentModelId: "",
  equipmentStatusId: "",
  ownerEntityId: "",
  currentSpatialNodeId: "",
  immobilizationId: "",
  technicalCharacteristics: "",
  notes: "",
  receivedAt: "",
  commissionedAt: "",
  lastInventoryAt: "",
  assignments: []
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toFormState(asset: AssetDetail): AssetFormState {
  return {
    internalCode: asset.internalCode,
    numPiece: asset.numPiece ?? "",
    externalRef: asset.externalRef ?? "",
    serialNumber: asset.serialNumber ?? "",
    equipmentTypeId: asset.equipmentType.id,
    equipmentModelId: asset.equipmentModel?.id ?? "",
    equipmentStatusId: asset.equipmentStatus.id,
    ownerEntityId: asset.ownerEntity.id,
    currentSpatialNodeId: asset.currentSpatialNodeId ?? "",
    immobilizationId: asset.immobilizationId ?? "",
    technicalCharacteristics: asset.technicalCharacteristics ?? "",
    notes: asset.notes ?? "",
    receivedAt: toDateInputValue(asset.receivedAt),
    commissionedAt: toDateInputValue(asset.commissionedAt),
    lastInventoryAt: toDateInputValue(asset.lastInventoryAt),
    assignments: asset.activeAssignments
      .filter((assignment) => assignment.assignmentType !== "LOCATION")
      .map((assignment) => ({
        assignmentType: assignment.assignmentType,
        targetUserId: assignment.targetUserId,
        targetPersonName: assignment.targetPersonName,
        targetLocationId: null,
        targetEquipmentId: assignment.targetEquipmentId,
        startsAt: toDateInputValue(assignment.startsAt),
        endsAt: toDateInputValue(assignment.endsAt),
        notes: assignment.notes
      }))
  };
}

function buildSpatialNodeLabel(node: SpatialNodeListItem) {
  return `${node.label} - ${node.type}`;
}

function buildAssetLabel(asset: AssetListItem) {
  return `${asset.equipmentModel?.label ?? asset.equipmentType.label} - ${asset.internalCode}`;
}

function buildReferenceLabel(item: EquipmentReferenceItem | null, emptyLabel: string) {
  return item?.label ?? emptyLabel;
}

function buildReferenceMap(items: EquipmentReferenceItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function normalizeOptionalDateString(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : null;
}

function normalizeAssignmentsForPayload(assignments: AssetAssignmentInput[]) {
  return assignments.map((assignment) => ({
    ...assignment,
    targetUserId: assignment.targetUserId ?? null,
    targetPersonName: assignment.targetPersonName?.trim() ? assignment.targetPersonName : null,
    targetLocationId: assignment.targetLocationId ?? null,
    targetEquipmentId: assignment.targetEquipmentId ?? null,
    startsAt: normalizeOptionalDateString(assignment.startsAt),
    endsAt: normalizeOptionalDateString(assignment.endsAt),
    notes: assignment.notes?.trim() ? assignment.notes : null
  }));
}

function buildTypePath(
  item: EquipmentReferenceItem | null,
  subfamiliesById: Map<string, EquipmentReferenceItem>,
  familiesById: Map<string, EquipmentReferenceItem>,
  categoriesById: Map<string, EquipmentReferenceItem>
) {
  if (!item) {
    return "Choisir un type";
  }
  const subfamily = item.parentId ? subfamiliesById.get(item.parentId) ?? null : null;
  const family = subfamily?.parentId ? familiesById.get(subfamily.parentId) ?? null : null;
  const category = family?.parentId ? categoriesById.get(family.parentId) ?? null : null;
  return [category?.label, family?.label, subfamily?.label, item.label].filter(Boolean).join(" > ");
}

function buildModelPath(item: EquipmentReferenceItem | null) {
  if (!item) {
    return "Modele inconnu";
  }
  return [item.parentLabel, item.label].filter(Boolean).join(" > ");
}

function buildImmobilizationLabel(item: ImmobilizationSummary | null) {
  if (!item) {
    return "Aucune immobilisation";
  }
  return `${item.code} - ${item.label}${item.isActive ? "" : " (archivee)"}`;
}

function movementTypeLabel(type: EquipmentMovementSummary["movementType"]) {
  return {
    INITIAL_STATE: "Etat initial",
    LOCATION_CHANGED: "Changement de localisation",
    ASSIGNMENT_ADDED: "Affectation ajoutee",
    ASSIGNMENT_REMOVED: "Affectation retiree",
    ASSIGNMENT_CHANGED: "Affectation modifiee"
  }[type];
}

function movementSourceLabel(source: EquipmentMovementSummary["source"]) {
  return {
    USER: "Utilisateur",
    IMPORT: "Import",
    SYSTEM: "Systeme"
  }[source];
}

function assignmentLabel(snapshot: EquipmentMovementSummary["toAssignmentSnapshot"]) {
  if (!snapshot) {
    return "-";
  }
  if (snapshot.assignmentType === "PERSON") {
    return snapshot.targetUserName ?? snapshot.targetUserEmail ?? snapshot.targetPersonName ?? "-";
  }
  return snapshot.targetEquipmentInternalCode
    ? `${snapshot.targetEquipmentInternalCode} - ${
        snapshot.targetEquipmentModelLabel ?? snapshot.targetEquipmentTypeLabel ?? ""
      }`.trim()
    : "-";
}

function movementBeforeAfter(movement: EquipmentMovementSummary) {
  if (movement.movementType === "LOCATION_CHANGED" || movement.toSpatialSnapshot || movement.fromSpatialSnapshot) {
    return {
      before: movement.fromSpatialSnapshot?.label ?? "-",
      after: movement.toSpatialSnapshot?.label ?? "-"
    };
  }
  return {
    before: assignmentLabel(movement.fromAssignmentSnapshot),
    after: assignmentLabel(movement.toAssignmentSnapshot)
  };
}

export function AssetEditorPage({ assetId }: AssetEditorPageProps) {
  const router = useRouter();
  const token = useStoredToken();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
  const [movements, setMovements] = useState<EquipmentMovementSummary[]>([]);
  const [types, setTypes] = useState<EquipmentReferenceItem[]>([]);
  const [categories, setCategories] = useState<EquipmentReferenceItem[]>([]);
  const [families, setFamilies] = useState<EquipmentReferenceItem[]>([]);
  const [subfamilies, setSubfamilies] = useState<EquipmentReferenceItem[]>([]);
  const [models, setModels] = useState<EquipmentReferenceItem[]>([]);
  const [statuses, setStatuses] = useState<EquipmentReferenceItem[]>([]);
  const [owners, setOwners] = useState<EquipmentReferenceItem[]>([]);
  const [attachmentRules, setAttachmentRules] = useState<
    Array<{ sourceFamilyId: string; targetFamilyId: string; isActive: boolean }>
  >([]);
  const [spatialNodes, setSpatialNodes] = useState<SpatialNodeListItem[]>([]);
  const [immobilizations, setImmobilizations] = useState<ImmobilizationSummary[]>([]);
  const [users, setUsers] = useState<AssetAssignableUser[]>([]);
  const [allAssets, setAllAssets] = useState<AssetListItem[]>([]);
  const [form, setForm] = useState<AssetFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    const referencesPromise = Promise.all([
      apiFetch<EquipmentReferenceItem[]>("/assets/references/categories?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/families?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/subfamilies?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/types?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/models?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/statuses?state=active"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/owners?state=active"),
      apiFetch<Array<{ sourceFamilyId: string; targetFamilyId: string; isActive: boolean }>>(
        "/assets/references/attachment-rules?state=active"
      ),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>("/spatial/nodes?page=1&pageSize=200&sort=path&direction=asc&isActive=true"),
      apiFetch<PaginatedResponse<ImmobilizationSummary>>("/immobilizations?page=1&pageSize=200&sort=code&direction=asc"),
      apiFetch<AssetAssignableUser[]>("/assets/assignment-users"),
      apiFetch<PaginatedResponse<AssetListItem>>("/assets?page=1&pageSize=200&isArchived=false")
    ]);

    if (!assetId) {
      const references = await referencesPromise;
      return {
        references,
        detail: null as AssetDetail | null,
        history: [] as AssetHistoryEntry[],
        movements: [] as EquipmentMovementSummary[]
      };
    }

    const [references, detail, timeline, movementTimeline] = await Promise.all([
      referencesPromise,
      apiFetch<AssetDetail>(`/assets/${assetId}`),
      apiFetch<AssetHistoryEntry[]>(`/assets/${assetId}/history`),
      apiFetch<PaginatedResponse<EquipmentMovementSummary>>(
        `/assets/${assetId}/movements?page=1&pageSize=200&sort=createdAt&direction=desc`
      )
    ]);
    return { references, detail, history: timeline, movements: movementTimeline.items };
  }, [assetId, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { references, detail, history: timeline, movements: movementTimeline } = await loadData();
        if (cancelled) {
          return;
        }
        const [
          categoriesResponse,
          familiesResponse,
          subfamiliesResponse,
          typesResponse,
          modelsResponse,
          statusesResponse,
          ownersResponse,
          rulesResponse,
          spatialNodesResponse,
          immobilizationsResponse,
          usersResponse,
          assetsResponse
        ] = references;

        setCategories(categoriesResponse);
        setFamilies(familiesResponse);
        setSubfamilies(subfamiliesResponse);
        setTypes(typesResponse);
        setModels(modelsResponse);
        setStatuses(statusesResponse);
        setOwners(ownersResponse);
        setAttachmentRules(rulesResponse);
        setSpatialNodes(spatialNodesResponse.items.filter((item) => item.type !== "LOCATION"));
        setImmobilizations(immobilizationsResponse.items);
        setUsers(usersResponse);
        setAllAssets(assetsResponse.items);
        setAsset(detail);
        setHistory(timeline);
        setMovements(movementTimeline);
        setForm(detail ? toFormState(detail) : emptyForm);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger l equipement");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const selectedType = useMemo(
    () => types.find((item) => item.id === form.equipmentTypeId) ?? null,
    [form.equipmentTypeId, types]
  );
  const categoriesById = useMemo(() => buildReferenceMap(categories), [categories]);
  const familiesById = useMemo(() => buildReferenceMap(families), [families]);
  const subfamiliesById = useMemo(() => buildReferenceMap(subfamilies), [subfamilies]);
  const selectedModel = useMemo(
    () => models.find((item) => item.id === form.equipmentModelId) ?? null,
    [form.equipmentModelId, models]
  );
  const selectedStatus = useMemo(
    () => statuses.find((item) => item.id === form.equipmentStatusId) ?? null,
    [form.equipmentStatusId, statuses]
  );
  const selectedOwner = useMemo(
    () => owners.find((item) => item.id === form.ownerEntityId) ?? null,
    [form.ownerEntityId, owners]
  );
  const selectedSpatialNode = useMemo(
    () => spatialNodes.find((item) => item.id === form.currentSpatialNodeId) ?? null,
    [form.currentSpatialNodeId, spatialNodes]
  );
  const selectedImmobilization = useMemo(
    () => immobilizations.find((item) => item.id === form.immobilizationId) ?? null,
    [form.immobilizationId, immobilizations]
  );
  const selectedFamilyId = selectedType?.parentId ?? null;
  const allowedTargetFamilyIds = useMemo(
    () =>
      attachmentRules
        .filter((rule) => rule.sourceFamilyId === selectedFamilyId && rule.isActive)
        .map((rule) => rule.targetFamilyId),
    [attachmentRules, selectedFamilyId]
  );
  const compatibleAssets = useMemo(
    () =>
      allAssets.filter(
        (item) =>
          item.id !== assetId &&
          (allowedTargetFamilyIds.length === 0 || allowedTargetFamilyIds.includes(item.equipmentType.familyId))
      ),
    [allAssets, allowedTargetFamilyIds, assetId]
  );

  const assetReadOnlySections = asset ? (
    <>
      <PageSection title="Resume courant" description="Etat et metadonnees de l equipement.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ReadOnlyField label="Creation" value={formatDate(asset.createdAt)} />
          <ReadOnlyField label="Mise a jour" value={formatDate(asset.updatedAt)} />
          <ReadOnlyField label="Num piece" value={asset.numPiece ?? "-"} />
          <ReadOnlyField label="Reference externe" value={asset.externalRef ?? "-"} />
          <ReadOnlyField label="Famille" value={asset.equipmentType.familyLabel} />
          <ReadOnlyField label="Sous-famille" value={asset.equipmentType.subfamilyLabel} />
          <ReadOnlyField
            label="Type"
            value={buildTypePath(selectedType, subfamiliesById, familiesById, categoriesById)}
          />
          <ReadOnlyField label="Modele" value={buildModelPath(selectedModel ?? null)} />
          <ReadOnlyField label="Statut" value={selectedStatus?.label ?? asset.equipmentStatus.label} />
          <ReadOnlyField label="Proprietaire" value={selectedOwner?.label ?? asset.ownerEntity.label} />
          <ReadOnlyField
            label="Immobilisation"
            value={
              selectedImmobilization
                ? buildImmobilizationLabel(selectedImmobilization)
                : asset.immobilizationCode
                  ? `${asset.immobilizationCode} - ${asset.immobilizationLabel ?? ""}`.trim()
                  : "-"
            }
          />
          <ReadOnlyField label="Localisation courante" value={asset.currentSpatialLabel ?? "-"} />
          <ReadOnlyField label="Reception" value={asset.receivedAt ? formatDate(asset.receivedAt) : "-"} />
          <ReadOnlyField
            label="Mise en service"
            value={asset.commissionedAt ? formatDate(asset.commissionedAt) : "-"}
          />
          <ReadOnlyField
            label="Dernier inventaire"
            value={asset.lastInventoryAt ? formatDate(asset.lastInventoryAt) : "-"}
          />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Etat</p>
            <div className="flex min-h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3 py-2">
              <StatusBadge
                status={asset.isDeleted ? "inactive" : "active"}
                label={asset.isDeleted ? "Archive" : "Actif"}
              />
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Mouvements equipement"
        description="Timeline metier derivee des changements de localisation et d affectation."
      >
        <div className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement metier enregistre.</p>
          ) : (
            movements.map((movement) => {
              const values = movementBeforeAfter(movement);
              return (
                <div key={movement.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{movementTypeLabel(movement.movementType)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(movement.createdAt)}
                        {movement.createdByEmail ? ` - ${movement.createdByEmail}` : ""}
                      </p>
                    </div>
                    <StatusBadge status="neutral" label={movementSourceLabel(movement.source)} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ReadOnlyField label="Avant" value={values.before} />
                    <ReadOnlyField label="Apres" value={values.after} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PageSection>

      <PageSection title="Historique" description="Timeline issue du journal d audit.">
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun evenement d historique.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="font-medium text-foreground">{entry.action}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                  {entry.userEmail ? ` - ${entry.userEmail}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </PageSection>
    </>
  ) : null;

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <EditFormPage
        eyebrow="Equipements"
        title={asset ? `Equipement ${asset.internalCode}` : "Nouvel equipement"}
        description="Gestion des actifs patrimoniaux unitaires, de leur position courante et de leurs affectations."
        headerActions={
          <Button variant="outline" onClick={() => router.push("/assets")}>
            <ArrowLeftIcon className="size-4" />
            Retour a la liste
          </Button>
        }
        sections={
          <>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {assetReadOnlySections}

            <FormSection
              title="Identite"
              description="Code interne terrain et numero de serie constructeur si disponible."
            >
              <Field label="Code interne">
                <Input
                  value={form.internalCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, internalCode: event.target.value }))
                  }
                />
              </Field>
              <Field label="Num piece">
                <Input
                  value={form.numPiece}
                  placeholder="Optionnel"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, numPiece: event.target.value }))
                  }
                />
              </Field>
              <Field label="Reference externe">
                <Input
                  value={form.externalRef}
                  placeholder="Optionnel"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, externalRef: event.target.value }))
                  }
                />
              </Field>
              <Field label="Numero de serie">
                <Input
                  value={form.serialNumber}
                  placeholder="Optionnel"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, serialNumber: event.target.value }))
                  }
                />
              </Field>
            </FormSection>

            <FormSection
              title="Classification"
              description="Type, modele, statut et proprietaire affiches avec leur libelle metier."
            >
              <Field label="Type">
                <Select
                  value={form.equipmentTypeId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, equipmentTypeId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un type">
                      {buildTypePath(selectedType, subfamiliesById, familiesById, categoriesById)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir un type</SelectItem>
                    {types.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {buildTypePath(item, subfamiliesById, familiesById, categoriesById)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Modele">
                <Select
                  value={form.equipmentModelId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, equipmentModelId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un modele">
                      {buildModelPath(selectedModel)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Modele inconnu</SelectItem>
                    {models.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {buildModelPath(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Statut">
                <Select
                  value={form.equipmentStatusId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, equipmentStatusId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un statut">
                      {buildReferenceLabel(selectedStatus, "Choisir un statut")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir un statut</SelectItem>
                    {statuses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Proprietaire">
                <Select
                  value={form.ownerEntityId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, ownerEntityId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un proprietaire">
                      {buildReferenceLabel(selectedOwner, "Choisir un proprietaire")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir un proprietaire</SelectItem>
                    {owners.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FormSection>

            <FormSection
              title="Localisation courante"
              description="Position courante de l equipement dans le referentiel spatial."
            >
              <Field label="Noeud spatial">
                <Select
                  value={form.currentSpatialNodeId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, currentSpatialNodeId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un noeud spatial">
                      {selectedSpatialNode ? buildSpatialNodeLabel(selectedSpatialNode) : "Choisir un noeud spatial"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune localisation courante</SelectItem>
                    {spatialNodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {buildSpatialNodeLabel(node)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <ReadOnlyField
                label="Chemin courant"
                value={selectedSpatialNode?.path ?? asset?.currentSpatialPath ?? "-"}
              />
            </FormSection>

            <FormSection
              title="Comptabilite"
              description="Rattachement optionnel a une immobilisation comptable."
            >
              <Field label="Immobilisation">
                <Select
                  value={form.immobilizationId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value && value !== "none" ? value : "";
                    setForm((current) => ({ ...current, immobilizationId: nextValue }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune immobilisation">
                      {buildImmobilizationLabel(selectedImmobilization)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune immobilisation</SelectItem>
                    {immobilizations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {buildImmobilizationLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <ReadOnlyField
                label="Equipements rattaches"
                value={selectedImmobilization ? String(selectedImmobilization.equipmentsCount) : "-"}
              />
            </FormSection>

            <FormSection
              title="Dates metier"
              description="Dates utiles pour la reception, la mise en service et le dernier inventaire."
            >
              <Field label="Reception">
                <Input
                  className="max-w-44"
                  type="date"
                  value={form.receivedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, receivedAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="Mise en service">
                <Input
                  className="max-w-44"
                  type="date"
                  value={form.commissionedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, commissionedAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="Dernier inventaire">
                <Input
                  className="max-w-44"
                  type="date"
                  value={form.lastInventoryAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, lastInventoryAt: event.target.value }))
                  }
                />
              </Field>
            </FormSection>

            <FormSection title="Caracteristiques" description="Texte libre technique et notes metier." columns={1}>
              <Field label="Caracteristiques techniques">
                <Textarea
                  value={form.technicalCharacteristics}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      technicalCharacteristics: event.target.value
                    }))
                  }
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
            </FormSection>

            <FormSection
              title="Affectations"
              description="Affectations actives par utilisateur interne ou asset parent. La localisation courante est geree au dessus."
              columns={1}
            >
              <AssetAssignmentEditor
                assignments={form.assignments}
                users={users}
                assets={compatibleAssets}
                onChange={(assignments) => setForm((current) => ({ ...current, assignments }))}
              />
            </FormSection>
          </>
        }
        primaryActions={
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                const payload = {
                  internalCode: form.internalCode,
                  numPiece: form.numPiece || null,
                  externalRef: form.externalRef || null,
                  serialNumber: form.serialNumber || null,
                  equipmentTypeId: form.equipmentTypeId,
                  equipmentModelId: form.equipmentModelId || null,
                  equipmentStatusId: form.equipmentStatusId,
                  ownerEntityId: form.ownerEntityId,
                  currentSpatialNodeId: form.currentSpatialNodeId || null,
                  immobilizationId: form.immobilizationId || null,
                  technicalCharacteristics: form.technicalCharacteristics || null,
                  notes: form.notes || null,
                  receivedAt: normalizeOptionalDateString(form.receivedAt),
                  commissionedAt: normalizeOptionalDateString(form.commissionedAt),
                  lastInventoryAt: normalizeOptionalDateString(form.lastInventoryAt),
                  assignments: normalizeAssignmentsForPayload(form.assignments)
                };
                const result = assetId
                  ? await apiFetch<AssetDetail>(`/assets/${assetId}`, {
                      method: "PATCH",
                      body: JSON.stringify(payload)
                    })
                  : await apiFetch<AssetDetail>("/assets", {
                      method: "POST",
                      body: JSON.stringify(payload)
                    });
                router.push(`/assets/${result.id}`);
              } catch (saveError) {
                if (isUnauthorizedApiError(saveError)) {
                  setError(null);
                  return;
                }
                setError(
                  saveError instanceof Error
                    ? saveError.message
                    : "Impossible d enregistrer l equipement"
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <SaveIcon className="size-4" />
            {saving ? "Enregistrement..." : assetId ? "Enregistrer" : "Creer l equipement"}
          </Button>
        }
        secondaryActions={
          <Button variant="ghost" onClick={() => router.push("/assets")}>
            Annuler
          </Button>
        }
        destructiveActions={
          assetId ? (
            <Button
              variant="destructive"
              disabled={archiving || asset?.isDeleted}
              onClick={async () => {
                setArchiving(true);
                setError(null);
                try {
                  await apiFetch(`/assets/${assetId}/archive`, { method: "POST" });
                  router.refresh();
                } catch (archiveError) {
                  if (isUnauthorizedApiError(archiveError)) {
                    setError(null);
                    return;
                  }
                  setError(
                    archiveError instanceof Error
                      ? archiveError.message
                      : "Impossible d archiver l equipement"
                  );
                } finally {
                  setArchiving(false);
                }
              }}
            >
              <ArchiveIcon className="size-4" />
              {archiving ? "Archivage..." : asset?.isDeleted ? "Archive" : "Archiver"}
            </Button>
          ) : undefined
        }
      />
    </AppShell>
  );
}
