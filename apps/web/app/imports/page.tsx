"use client";

import type {
  CurrentUserResponse,
  ImportJobDetail,
  ImportJobPurgeCreatedDataResult,
  ImportJobReport,
  ImportJobSummary,
  ImportJobStatus,
  ImportMappingInput,
  ImportProfileDetail,
  ImportProfileSummary,
  ImportSourceKind,
  ImportTargetDomain,
  ImportTargetFieldDefinition,
  Ifc4AnalysisResponse,
  Ifc4AssetReferenceCandidate,
  Ifc4AssetReferencesApplyResult,
  Ifc4CreateJobResponse,
  Ifc4EquipmentPropertyMappings,
  Ifc4EquipmentPreviewRow,
  Ifc4PropertyCandidate,
  Ifc4SpatialPreviewNode,
  OrganizationSettings,
  OrganizationSpatialDisplaySettings,
  PaginatedResponse,
  RunImportJobInput,
  SpatialNodeType
} from "@inventory/shared";
import {
  buildDefaultOrganizationSettings,
  formatNumber,
  IMPORT_JOB_STATUSES,
  IMPORT_TARGET_DOMAINS,
  SPATIAL_NODE_TYPES,
  IMPORT_TRANSFORM_TYPES
} from "@inventory/shared";
import {
  Badge,
  Button,
  DataGrid,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FilterBar,
  FormSection,
  Input,
  ListPage,
  PageSection,
  PaginationBar,
  ReadOnlyField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SpatialNodeChip,
  SpatialNodeTitle,
  SelectValue
} from "@inventory/ui";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  FileUpIcon,
  FolderInputIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldAlertIcon,
  Trash2Icon,
  XIcon,
  XCircleIcon
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ImportsHelpPanel } from "@/components/imports-help-panel";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { ApiError, apiFetch, apiUpload, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { buildPathWithQuery } from "@/lib/url-query";
import { useStoredToken } from "@/lib/session";

type MappingDraft = {
  key: string;
  targetField: string;
  label: string;
  description: string | null;
  required: boolean;
  sourceColumn: string;
  transformType: (typeof IMPORT_TRANSFORM_TYPES)[number];
  transformConfigText: string;
  isRequired: boolean;
};

type Ifc4SpatialTreeRow = Ifc4SpatialPreviewNode & {
  depth: number;
  hasChildren: boolean;
};

type Ifc4EffectiveAssetReference = Ifc4AssetReferenceCandidate & {
  effectiveResource: Ifc4AssetReferenceCandidate["resource"];
};

type Ifc4EquipmentReferenceDisplay = {
  label: string;
  code: string | null;
  exists: boolean | null;
};

type Ifc4EquipmentClassification = {
  category: Ifc4EquipmentReferenceDisplay;
  family: Ifc4EquipmentReferenceDisplay;
  subfamily: Ifc4EquipmentReferenceDisplay;
  type: Ifc4EquipmentReferenceDisplay;
  brand: Ifc4EquipmentReferenceDisplay;
  model: Ifc4EquipmentReferenceDisplay;
  status: Ifc4EquipmentReferenceDisplay;
  owner: Ifc4EquipmentReferenceDisplay;
};

type Ifc4EquipmentValidationRow = Ifc4EquipmentPreviewRow & {
  spatialNode: Ifc4SpatialPreviewNode | null;
  classification: Ifc4EquipmentClassification;
  anomalyReasons: string[];
  isSpatiallyAttached: boolean;
};

type Ifc4EquipmentPropertyMappingField = keyof Required<Ifc4EquipmentPropertyMappings>;

const NONE_VALUE = "__none__";

const TARGET_DOMAIN_LABELS: Record<ImportTargetDomain, string> = {
  "spatial-nodes": "Referentiel spatial",
  equipments: "Referentiel equipements",
  immobilizations: "Referentiel immobilisations"
};

function canPurgeJob(job: Pick<ImportJobSummary, "targetDomain" | "writeSummary"> | null | undefined) {
  if (!job || !EXECUTABLE_DOMAINS.has(job.targetDomain)) {
    return false;
  }
  return (job.writeSummary?.createdCount ?? 0) > 0 || (job.writeSummary?.updatedCount ?? 0) > 0;
}

function canDeleteJob(job: Pick<ImportJobSummary, "status"> | Pick<ImportJobDetail, "status"> | null | undefined) {
  if (!job) {
    return false;
  }
  return job.status !== "RUNNING";
}

const EXECUTABLE_DOMAINS = new Set<ImportTargetDomain>(["spatial-nodes", "equipments", "immobilizations"]);
const TERMINAL_JOB_STATUSES = new Set<ImportJobStatus>(["COMPLETED", "FAILED", "CANCELLED"]);
const IFC_PREVIEW_PAGE_SIZE = 10;

function geometryBadgeLabel(status: string | undefined) {
  if (status === "READY") return "Geometrie OK";
  if (status === "ERROR") return "Erreur geometrie";
  return "Geometrie manquante";
}

function geometryBadgeVariant(status: string | undefined) {
  if (status === "READY") return "outline" as const;
  return "destructive" as const;
}

function geometrySizeLabel(geometry: Ifc4SpatialPreviewNode["geometry"] | Ifc4EquipmentPreviewRow["geometry"]) {
  if (!geometry?.worldSize) return "-";
  return `${geometry.worldSize.x.toFixed(2)} x ${geometry.worldSize.y.toFixed(2)} x ${geometry.worldSize.z.toFixed(2)} m`;
}

function stringifyDiagnosticValue(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatDetailedApiError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : fallback;
  }
  const payload = error.payload;
  const lines = [error.message];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["code", "filename", "detail", "python", "worker", "missingCount", "missingNodes", "missingEquipments"]) {
      const value = stringifyDiagnosticValue(record[key]);
      if (value) {
        lines.push(`${key}: ${value}`);
      }
    }
    if (Array.isArray(record.examples) && record.examples.length > 0) {
      lines.push(`examples: ${record.examples.slice(0, 5).map((item) => stringifyDiagnosticValue(item)).filter(Boolean).join(" | ")}`);
    }
  }
  return lines.join("\n");
}
const IFC_SPATIAL_TYPES = SPATIAL_NODE_TYPES.filter((type) => type !== "LOCATION");
const IFC_ASSET_REFERENCE_LABELS: Record<Ifc4AssetReferenceCandidate["resource"], string> = {
  categories: "Categorie",
  families: "Famille",
  subfamilies: "Sous-famille",
  types: "Type",
  brands: "Marque",
  models: "Modele",
  statuses: "Statut",
  owners: "Proprietaire"
};
const IFC_ASSET_REFERENCE_RESOURCES = Object.keys(IFC_ASSET_REFERENCE_LABELS) as Ifc4AssetReferenceCandidate["resource"][];
const IFC_EQUIPMENT_PROPERTY_MAPPING_FIELDS: Array<{
  key: Ifc4EquipmentPropertyMappingField;
  label: string;
  description: string;
}> = [
  { key: "internalCode", label: "Code equipement", description: "Code interne terrain de l equipement." },
  { key: "numPiece", label: "Num piece", description: "Numero ou code de piece associe a l equipement." },
  { key: "externalRef", label: "Reference externe", description: "Reference source externe de l equipement." },
  { key: "category", label: "Categorie", description: "Reference categorie de l equipement." },
  { key: "family", label: "Famille", description: "Reference famille rattachee a la categorie." },
  { key: "subfamily", label: "Sous-famille", description: "Reference sous-famille rattachee a la famille." },
  { key: "type", label: "Type", description: "Type metier de l equipement." },
  { key: "brand", label: "Marque", description: "Fabricant ou marque commerciale." },
  { key: "model", label: "Modele", description: "Modele ou gamme du fabricant." },
  { key: "status", label: "Statut", description: "Statut metier si present dans l IFC." },
  { key: "owner", label: "Proprietaire", description: "Proprietaire ou entite responsable si present dans l IFC." }
];
const DEFAULT_IFC_EQUIPMENT_PROPERTY_MAPPINGS: Ifc4EquipmentPropertyMappings = {
  internalCode: null,
  numPiece: null,
  externalRef: null,
  category: null,
  family: null,
  subfamily: null,
  type: null,
  brand: null,
  model: null,
  status: null,
  owner: null
};

function formatPurgeSuccess(result: ImportJobPurgeCreatedDataResult) {
  const parts = [
    result.summary.purgedNodes ? `${result.summary.purgedNodes} noeud(s)` : null,
    result.summary.purgedScopes ? `${result.summary.purgedScopes} scope(s) IAM` : null,
    result.summary.purgedEquipments ? `${result.summary.purgedEquipments} equipement(s)` : null,
    result.summary.purgedImmobilizations ? `${result.summary.purgedImmobilizations} immobilisation(s)` : null,
    result.summary.purgedMovements ? `${result.summary.purgedMovements} mouvement(s)` : null,
    result.summary.purgedAssignments ? `${result.summary.purgedAssignments} affectation(s)` : null
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(", ")} supprime(s).` : "Aucune creation metier presente n a ete supprimee.";
}

function createEmptyDraft(field: ImportTargetFieldDefinition, mapping?: ImportMappingInput | null): MappingDraft {
  return {
    key: field.key,
    targetField: field.key,
    label: field.label,
    description: field.description,
    required: field.required,
    sourceColumn: mapping?.sourceColumn ?? "",
    transformType:
      mapping?.transformType ?? (field.key === "isActive" ? "BOOLEAN" : "TRIM"),
    transformConfigText: mapping?.transformConfig ? JSON.stringify(mapping.transformConfig) : "",
    isRequired: mapping?.isRequired ?? field.required
  };
}

function mergeDrafts(
  fields: ImportTargetFieldDefinition[],
  mappings: ImportMappingInput[] | null | undefined
) {
  const byField = new Map((mappings ?? []).map((mapping) => [mapping.targetField, mapping]));
  return fields.map((field) => createEmptyDraft(field, byField.get(field.key) ?? null));
}

function normalizeMappingDrafts(drafts: MappingDraft[]) {
  return drafts.filter((draft) => draft.sourceColumn.trim().length > 0 || draft.transformType === "CONSTANT");
}

function parseTransformConfig(transformType: MappingDraft["transformType"], rawText: string) {
  const normalized = rawText.trim();
  if (!normalized) {
    return null;
  }

  if (transformType === "CONSTANT") {
    if (normalized.startsWith("{")) {
      const parsed = JSON.parse(normalized) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Le transformConfig CONSTANT doit etre un objet JSON");
      }
      return parsed as Record<string, unknown>;
    }
    return { value: normalized };
  }

  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Le transformConfig doit etre un objet JSON");
  }
  return parsed as Record<string, unknown>;
}

function buildMappingsPayload(drafts: MappingDraft[]) {
  return normalizeMappingDrafts(drafts).map((draft) => ({
    sourceColumn: draft.sourceColumn.trim(),
    targetField: draft.targetField,
    transformType: draft.transformType,
    transformConfig: parseTransformConfig(draft.transformType, draft.transformConfigText),
    isRequired: draft.isRequired
  })) satisfies ImportMappingInput[];
}

function canonicalizeMappings(mappings: ImportMappingInput[]) {
  return JSON.stringify(
    [...mappings]
      .map((mapping) => ({
        sourceColumn: mapping.sourceColumn,
        targetField: mapping.targetField,
        transformType: mapping.transformType,
        transformConfig: mapping.transformConfig ?? null,
        isRequired: mapping.isRequired ?? false
      }))
      .sort((left, right) => left.targetField.localeCompare(right.targetField))
  );
}

function getStatusTone(status: ImportJobStatus | ImportJobReport["rows"][number]["status"]) {
  if (status === "COMPLETED" || status === "READY" || status === "CREATED" || status === "UPDATED") {
    return "success";
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "REJECTED") {
    return "danger";
  }
  if (status === "VALIDATED" || status === "MAPPED" || status === "UPLOADED" || status === "WARNING") {
    return "warning";
  }
  return "muted";
}

function StatusPill({ label }: { label: ImportJobStatus | ImportJobReport["rows"][number]["status"] }) {
  const tone = getStatusTone(label);
  return (
    <span
      className={
        tone === "success"
          ? "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          : tone === "danger"
            ? "inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700"
            : tone === "warning"
              ? "inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700"
              : "inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

function assetReferenceKey(resource: Ifc4AssetReferenceCandidate["resource"], code: string) {
  return `${resource}:${code}`;
}

function referenceDisplay(
  reference: Ifc4EffectiveAssetReference | null | undefined,
  fallbackCode: string | null | undefined
): Ifc4EquipmentReferenceDisplay {
  return {
    label: reference?.label ?? fallbackCode ?? "-",
    code: reference?.code ?? fallbackCode ?? null,
    exists: reference?.exists ?? null
  };
}

function compactReferenceValue(reference: Ifc4EquipmentReferenceDisplay) {
  if (!reference.code || reference.code === reference.label) {
    return reference.label;
  }
  return `${reference.label} (${reference.code})`;
}

function propertyCandidateLabel(candidate: Ifc4PropertyCandidate) {
  const sample = candidate.sampleValue ? ` - ex. ${candidate.sampleValue}` : "";
  return `${candidate.name}${sample} (${candidate.count})`;
}

function IfcEquipmentValidationCard({
  item,
  onOpen,
  indent = 0
}: {
  item: Ifc4EquipmentValidationRow;
  onOpen: (item: Ifc4EquipmentValidationRow) => void;
  indent?: number;
}) {
  const classificationRows = [
    ["Categorie", item.classification.category],
    ["Famille", item.classification.family],
    ["Sous-famille", item.classification.subfamily],
    ["Type", item.classification.type],
    ["Marque", item.classification.brand],
    ["Modele", item.classification.model],
    ["Statut", item.classification.status],
    ["Proprietaire", item.classification.owner]
  ] as const;

  return (
    <button
      type="button"
      className="block w-full rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      style={{ marginLeft: indent }}
      onClick={() => onOpen(item)}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Equipement</Badge>
            <p className="font-semibold text-foreground">{item.label ?? item.internalCode}</p>
            <span className="font-mono text-xs text-muted-foreground">{item.internalCode}</span>
            {item.numPiece ? <span className="font-mono text-xs text-muted-foreground">piece {item.numPiece}</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Composant : {compactReferenceValue(item.classification.type)} - Localisation :{" "}
            {item.spatialNode ? `${item.spatialNode.label} (${item.spatialNode.path})` : item.currentSpatialPath ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Badge variant="outline">{compactReferenceValue(item.classification.status)}</Badge>
          <Badge variant="outline">{compactReferenceValue(item.classification.owner)}</Badge>
          <Badge variant={item.isSpatiallyAttached ? "outline" : "destructive"}>
            {item.isSpatiallyAttached ? "Rattache" : "Anomalie"}
          </Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {classificationRows.map(([label, reference]) => (
          <div key={`${item.internalCode}-${label}`} className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-sm text-foreground">{compactReferenceValue(reference)}</p>
          </div>
        ))}
      </div>
      {item.anomalyReasons.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {item.anomalyReasons.join(" ")}
        </div>
      ) : null}
    </button>
  );
}

function paginateLocal<T>(items: T[], page: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * IFC_PREVIEW_PAGE_SIZE;
  return items.slice(start, start + IFC_PREVIEW_PAGE_SIZE);
}

function ImportsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = useStoredToken();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ifcFileInputRef = useRef<HTMLInputElement | null>(null);
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [currentDomain, setCurrentDomain] = useState<ImportTargetDomain>("spatial-nodes");
  const [jobsResponse, setJobsResponse] = useState<PaginatedResponse<ImportJobSummary> | null>(null);
  const [profilesResponse, setProfilesResponse] = useState<PaginatedResponse<ImportProfileSummary> | null>(null);
  const [fieldCatalog, setFieldCatalog] = useState<ImportTargetFieldDefinition[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ImportProfileDetail | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("none");
  const [currentJob, setCurrentJob] = useState<ImportJobDetail | null>(null);
  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);
  const [profileName, setProfileName] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [purgeBlocked, setPurgeBlocked] = useState<ImportJobPurgeCreatedDataResult["blocked"]>([]);
  const [pendingPurgeJob, setPendingPurgeJob] = useState<ImportJobSummary | null>(null);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<ImportJobSummary | ImportJobDetail | null>(null);
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [ifcAnalysis, setIfcAnalysis] = useState<Ifc4AnalysisResponse | null>(null);
  const [ifcSelectedClasses, setIfcSelectedClasses] = useState<string[]>(["IFCFURNITURE"]);
  const [ifcDefaultStatusCode, setIfcDefaultStatusCode] = useState("EN_SERVICE");
  const [ifcDefaultOwnerCode, setIfcDefaultOwnerCode] = useState("CPRP");
  const [ifcEquipmentPropertyMappings, setIfcEquipmentPropertyMappings] =
    useState<Ifc4EquipmentPropertyMappings>(DEFAULT_IFC_EQUIPMENT_PROPERTY_MAPPINGS);
  const [ifcApplyResult, setIfcApplyResult] = useState<Ifc4AssetReferencesApplyResult | null>(null);
  const [ifcSpatialTypeOverrides, setIfcSpatialTypeOverrides] = useState<Record<string, SpatialNodeType>>({});
  const [ifcSpatialExpandedPaths, setIfcSpatialExpandedPaths] = useState<string[]>([]);
  const [ifcSelectedSpatialPath, setIfcSelectedSpatialPath] = useState<string | null>(null);
  const [ifcAssetResourceOverrides, setIfcAssetResourceOverrides] = useState<Record<string, Ifc4AssetReferenceCandidate["resource"]>>({});
  const [ifcSpatialPage, setIfcSpatialPage] = useState(1);
  const [ifcAssetPage, setIfcAssetPage] = useState(1);
  const [ifcEquipmentPage, setIfcEquipmentPage] = useState(1);
  const [ifcEquipmentAnomalyPage, setIfcEquipmentAnomalyPage] = useState(1);
  const [selectedIfcEquipment, setSelectedIfcEquipment] = useState<Ifc4EquipmentValidationRow | null>(null);
  const [spatialDisplay, setSpatialDisplay] = useState<OrganizationSpatialDisplaySettings | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [urlSelectionReady, setUrlSelectionReady] = useState(false);
  const [jobsQuery, setJobsQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "createdAt" as "createdAt" | "updatedAt" | "status" | "targetDomain",
    direction: "desc" as "asc" | "desc",
    q: "",
    targetDomain: "spatial-nodes" as ImportTargetDomain | "all",
    status: "all" as ImportJobStatus | "all"
  });
  const deferredJobSearch = useDeferredValue(jobsQuery.q);

  const hasImportsRead = Boolean(me?.permissions.includes("imports.read"));
  const hasImportsManage = Boolean(me?.permissions.includes("imports.manage"));
  const hasImportsExecute = Boolean(me?.permissions.includes("imports.execute"));
  const domainIsExecutable = EXECUTABLE_DOMAINS.has(currentDomain);
  const currentHeaders = currentJob?.sourceSnapshot?.headers ?? [];
  const currentPreviewRows = currentJob?.sourceSnapshot?.previewRows ?? [];
  const currentReport = currentJob?.report ?? null;
  const selectedProfileSummary = profilesResponse?.items.find((profile) => profile.id === selectedProfile?.id) ?? null;
  const canUpload = hasImportsManage && domainIsExecutable && Boolean(currentJob);
  const canRun = hasImportsExecute && domainIsExecutable && Boolean(currentJob?.sourceSnapshot?.rawRowsRef);
  const canPersistProfile = hasImportsManage && Boolean(currentJob?.sourceKind);

  const mappingPayload = useMemo(() => {
    try {
      return buildMappingsPayload(mappingDrafts);
    } catch {
      return null;
    }
  }, [mappingDrafts]);

  const mappingDirty = useMemo(() => {
    if (!mappingPayload) {
      return true;
    }
    if (selectedProfile) {
      return canonicalizeMappings(mappingPayload) !== canonicalizeMappings(selectedProfile.mappings);
    }
    if (currentJob?.mappings?.length) {
      return canonicalizeMappings(mappingPayload) !== canonicalizeMappings(currentJob.mappings);
    }
    return normalizeMappingDrafts(mappingDrafts).length > 0;
  }, [currentJob?.mappings, mappingDrafts, mappingPayload, selectedProfile]);

  const profileOptions = profilesResponse?.items ?? [];

  const reportRows = currentReport?.rows ?? [];
  const reportPreviewRows = currentPreviewRows.map((row) => ({
    id: `preview-${row.rowIndex}`,
    rowIndex: row.rowIndex,
    values: row.values
  }));
  const ifcMissingReferences = ifcAnalysis?.assetReferences.filter((reference) => !reference.exists) ?? [];
  const ifcSpatialRows = ifcAnalysis?.spatialNodes ?? [];
  const ifcAssetRows = ifcAnalysis?.assetReferences ?? [];
  const ifcEquipmentRows = ifcAnalysis?.equipmentRows ?? [];
  const ifcPropertyCandidates = ifcAnalysis?.propertyCandidates ?? [];
  const hasIfcGeometryBlockingErrors = Boolean(
    ifcAnalysis?.geometrySummary &&
    ifcAnalysis.geometrySummary.missing + ifcAnalysis.geometrySummary.errors > 0
  );
  const ifcSpatialByPath = useMemo(() => {
    return new Map(ifcSpatialRows.map((row) => [row.path, row]));
  }, [ifcSpatialRows]);
  const ifcEffectiveAssetRows = useMemo<Ifc4EffectiveAssetReference[]>(() => {
    return ifcAssetRows.map((reference) => {
      const key = assetReferenceKey(reference.resource, reference.code);
      return {
        ...reference,
        effectiveResource: ifcAssetResourceOverrides[key] ?? reference.resource
      };
    });
  }, [ifcAssetResourceOverrides, ifcAssetRows]);
  const ifcAssetReferenceByResourceAndCode = useMemo(() => {
    const map = new Map<string, Ifc4EffectiveAssetReference>();
    for (const reference of ifcEffectiveAssetRows) {
      map.set(assetReferenceKey(reference.effectiveResource, reference.code), reference);
    }
    return map;
  }, [ifcEffectiveAssetRows]);
  const ifcEquipmentValidationRows = useMemo<Ifc4EquipmentValidationRow[]>(() => {
    const findReference = (resource: Ifc4AssetReferenceCandidate["resource"], code: string | null | undefined) =>
      code ? ifcAssetReferenceByResourceAndCode.get(assetReferenceKey(resource, code)) ?? null : null;

    return ifcEquipmentRows.map((row) => {
      const typeRef = findReference("types", row.equipmentTypeCode);
      const subfamilyRef = findReference("subfamilies", typeRef?.parentCode);
      const familyRef = findReference("families", subfamilyRef?.parentCode);
      const categoryRef = findReference("categories", familyRef?.parentCode);
      const modelRef = findReference("models", row.equipmentModelCode);
      const brandCode = modelRef?.parentCode ?? row.equipmentModelCode?.split("__")[0] ?? null;
      const brandRef = findReference("brands", brandCode);
      const statusRef = findReference("statuses", row.equipmentStatusCode);
      const ownerRef = findReference("owners", row.ownerEntityCode);
      const spatialNode = row.currentSpatialPath ? ifcSpatialByPath.get(row.currentSpatialPath) ?? null : null;
      const anomalyReasons: string[] = [];

      if (!row.currentSpatialPath) {
        anomalyReasons.push("Localisation cible absente : l equipement ne peut pas etre affiche dans l arborescence.");
      } else if (!spatialNode) {
        anomalyReasons.push(`Localisation cible introuvable dans le spatial extrait : ${row.currentSpatialPath}.`);
      }

      return {
        ...row,
        spatialNode,
        classification: {
          category: referenceDisplay(categoryRef, categoryRef?.code),
          family: referenceDisplay(familyRef, familyRef?.code),
          subfamily: referenceDisplay(subfamilyRef, subfamilyRef?.code),
          type: referenceDisplay(typeRef, row.equipmentTypeCode),
          brand: referenceDisplay(brandRef, brandCode),
          model: referenceDisplay(modelRef, row.equipmentModelCode),
          status: referenceDisplay(statusRef, row.equipmentStatusCode),
          owner: referenceDisplay(ownerRef, row.ownerEntityCode)
        },
        anomalyReasons,
        isSpatiallyAttached: Boolean(spatialNode)
      };
    });
  }, [ifcAssetReferenceByResourceAndCode, ifcEquipmentRows, ifcSpatialByPath]);
  const ifcEquipmentRowsBySpatialPath = useMemo(() => {
    const map = new Map<string, Ifc4EquipmentValidationRow[]>();
    for (const row of ifcEquipmentValidationRows) {
      if (!row.spatialNode) {
        continue;
      }
      const children = map.get(row.spatialNode.path) ?? [];
      children.push(row);
      map.set(row.spatialNode.path, children);
    }
    for (const children of map.values()) {
      children.sort((left, right) => left.internalCode.localeCompare(right.internalCode));
    }
    return map;
  }, [ifcEquipmentValidationRows]);
  const ifcEquipmentAnomalyRows = useMemo(() => {
    return ifcEquipmentValidationRows.filter((row) => !row.isSpatiallyAttached);
  }, [ifcEquipmentValidationRows]);
  const ifcSpatialChildrenByParentPath = useMemo(() => {
    const knownPaths = new Set(ifcSpatialRows.map((row) => row.path));
    const map = new Map<string | null, Ifc4SpatialPreviewNode[]>();
    for (const row of ifcSpatialRows) {
      const parentKey = row.parentPath && knownPaths.has(row.parentPath) ? row.parentPath : null;
      const children = map.get(parentKey) ?? [];
      children.push(row);
      map.set(parentKey, children);
    }
    for (const children of map.values()) {
      children.sort((left, right) => left.path.localeCompare(right.path));
    }
    return map;
  }, [ifcSpatialRows]);
  const ifcVisibleSpatialRows = useMemo<Ifc4SpatialTreeRow[]>(() => {
    const expanded = new Set(ifcSpatialExpandedPaths);
    const rows: Ifc4SpatialTreeRow[] = [];
    const visit = (node: Ifc4SpatialPreviewNode, depth: number) => {
      const children = ifcSpatialChildrenByParentPath.get(node.path) ?? [];
      const attachedEquipments = ifcEquipmentRowsBySpatialPath.get(node.path) ?? [];
      rows.push({
        ...node,
        depth,
        hasChildren: children.length > 0 || attachedEquipments.length > 0
      });
      if (!expanded.has(node.path)) {
        return;
      }
      for (const child of children) {
        visit(child, depth + 1);
      }
    };
    for (const root of ifcSpatialChildrenByParentPath.get(null) ?? []) {
      visit(root, 0);
    }
    return rows;
  }, [ifcEquipmentRowsBySpatialPath, ifcSpatialChildrenByParentPath, ifcSpatialExpandedPaths]);
  const pagedIfcSpatialRows = paginateLocal(ifcVisibleSpatialRows, ifcSpatialPage);
  const pagedIfcAssetRows = paginateLocal(ifcEffectiveAssetRows, ifcAssetPage);
  const pagedIfcEquipmentRows = paginateLocal(ifcEquipmentValidationRows, ifcEquipmentPage);
  const pagedIfcEquipmentAnomalyRows = paginateLocal(ifcEquipmentAnomalyRows, ifcEquipmentAnomalyPage);
  const displaySettings = useMemo<OrganizationSettings | null>(() => {
    if (!spatialDisplay) {
      return null;
    }
    return {
      ...buildDefaultOrganizationSettings(),
      spatialDisplay
    };
  }, [spatialDisplay]);
  const ifcEquipmentClassOptions = ifcAnalysis?.classSummary.filter((item) =>
    [
      "IFCFURNITURE",
      "IFCFURNISHINGELEMENT",
      "IFCFLOWTERMINAL",
      "IFCBUILDINGELEMENTPROXY",
      "IFCDISTRIBUTIONELEMENT",
      "IFCDISTRIBUTIONFLOWELEMENT",
      "IFCELEMENTASSEMBLY"
    ].includes(item.sourceClass)
  ) ?? [];

  const buildIfcFormData = useCallback(() => {
    if (!ifcFile) {
      throw new Error("Selectionne un fichier IFC4 avant de lancer l assistant");
    }
    const formData = new FormData();
    formData.append("file", ifcFile);
    formData.append("selectedClasses", JSON.stringify(ifcSelectedClasses));
    formData.append("defaultStatusCode", ifcDefaultStatusCode);
    formData.append("defaultOwnerEntityCode", ifcDefaultOwnerCode);
    formData.append(
      "equipmentOptions",
      JSON.stringify({
        selectedClasses: ifcSelectedClasses,
        defaultStatusCode: ifcDefaultStatusCode,
        defaultOwnerEntityCode: ifcDefaultOwnerCode,
        propertyMappings: ifcEquipmentPropertyMappings
      })
    );
    formData.append(
      "spatialOverrides",
      JSON.stringify(
        Object.entries(ifcSpatialTypeOverrides).map(([path, type]) => ({
          path,
          type
        }))
      )
    );
    formData.append(
      "assetReferenceOverrides",
      JSON.stringify(
        Object.entries(ifcAssetResourceOverrides).map(([key, nextResource]) => {
          const [resource, ...codeChunks] = key.split(":");
          return {
            resource,
            code: codeChunks.join(":"),
            nextResource
          };
        })
      )
    );
    return formData;
  }, [
    ifcAssetResourceOverrides,
    ifcDefaultOwnerCode,
    ifcDefaultStatusCode,
    ifcEquipmentPropertyMappings,
    ifcFile,
    ifcSelectedClasses,
    ifcSpatialTypeOverrides
  ]);

  const loadProfileDetail = useCallback(
    async (profileId: string, applyToEditor = true) => {
      if (profileId === "none") {
        setSelectedProfile(null);
        setSelectedProfileId("none");
        setProfileName("");
        if (fieldCatalog.length > 0) {
          setMappingDrafts((current) =>
            current.length > 0 && current.some((draft) => draft.sourceColumn || draft.transformConfigText)
              ? current
              : mergeDrafts(fieldCatalog, currentJob?.mappings)
          );
        }
        return;
      }

      const profile = await apiFetch<ImportProfileDetail>(`/imports/profiles/${profileId}`);
      const fields =
        currentDomain === profile.targetDomain && fieldCatalog.length > 0
          ? fieldCatalog
          : await apiFetch<ImportTargetFieldDefinition[]>(`/imports/targets/${profile.targetDomain}/fields`);

      setCurrentDomain(profile.targetDomain);
      setFieldCatalog(fields);
      setSelectedProfile(profile);
      setSelectedProfileId(profile.id);
      setProfileName(profile.name);
      if (applyToEditor) {
        setMappingDrafts(mergeDrafts(fields, profile.mappings));
      }
    },
    [currentDomain, currentJob?.mappings, fieldCatalog]
  );

  const loadJobs = useCallback(async () => {
    return apiFetch<PaginatedResponse<ImportJobSummary>>(
      `/imports/jobs${buildQueryString({
        page: jobsQuery.page,
        pageSize: jobsQuery.pageSize,
        sort: jobsQuery.sort,
        direction: jobsQuery.direction,
        q: deferredJobSearch,
        targetDomain: jobsQuery.targetDomain === "all" ? undefined : jobsQuery.targetDomain,
        status: jobsQuery.status === "all" ? undefined : jobsQuery.status
      })}`
    );
  }, [
    deferredJobSearch,
    jobsQuery.direction,
    jobsQuery.page,
    jobsQuery.pageSize,
    jobsQuery.sort,
    jobsQuery.status,
    jobsQuery.targetDomain
  ]);

  const refreshWorkspace = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    const meResponse = await apiFetch<CurrentUserResponse>("/auth/me");
    setMe(meResponse);

    if (!meResponse.permissions.includes("imports.read")) {
      setJobsResponse(null);
      setProfilesResponse(null);
      setFieldCatalog([]);
      return;
    }

    const [jobs, profiles, fields] = await Promise.all([
      loadJobs(),
      apiFetch<PaginatedResponse<ImportProfileSummary>>(
        `/imports/profiles${buildQueryString({
          page: 1,
          pageSize: 100,
          targetDomain: currentDomain,
          isArchived: "false",
          sort: "updatedAt",
          direction: "desc"
        })}`
      ),
      apiFetch<ImportTargetFieldDefinition[]>(`/imports/targets/${currentDomain}/fields`)
    ]);

    setJobsResponse(jobs);
    setProfilesResponse(profiles);
    setFieldCatalog(fields);
    try {
      setSpatialDisplay(await apiFetch<OrganizationSpatialDisplaySettings>("/spatial/nodes/display-settings"));
    } catch {
      setSpatialDisplay(null);
    }

    if (mappingDrafts.length === 0) {
      setMappingDrafts(mergeDrafts(fields, currentJob?.mappings));
    }
  }, [currentDomain, currentJob?.mappings, loadJobs, mappingDrafts.length, token]);

  const refreshWorkspaceSafely = useCallback(async () => {
    try {
      await refreshWorkspace();
      setPageError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setPageError(null);
        return;
      }
      setPageError(loadError instanceof Error ? loadError.message : "Impossible de charger le workspace imports");
    }
  }, [refreshWorkspace]);

  const openJob = useCallback(
    async (jobId: string) => {
      const job = await apiFetch<ImportJobDetail>(`/imports/jobs/${jobId}`);
      const fields =
        currentDomain === job.targetDomain && fieldCatalog.length > 0
          ? fieldCatalog
          : await apiFetch<ImportTargetFieldDefinition[]>(`/imports/targets/${job.targetDomain}/fields`);
      setCurrentJob(job);
      setPageError(null);
      setActionError(null);
      setActionNotice(null);
      setPurgeBlocked([]);
      setCurrentDomain(job.targetDomain);
      setFieldCatalog(fields);
      setMappingDrafts(mergeDrafts(fields, job.mappings));
      if (job.profileId) {
        try {
          await loadProfileDetail(job.profileId, false);
          setSelectedProfileId(job.profileId);
        } catch {
          setSelectedProfile(null);
          setSelectedProfileId("none");
        }
      } else {
        setSelectedProfile(null);
        setSelectedProfileId("none");
      }
    },
    [currentDomain, fieldCatalog, loadProfileDetail]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const jobId = searchParams.get("jobId");
    const profileId = searchParams.get("profileId");

    if (!jobId && !profileId) {
      setUrlSelectionReady(true);
      return;
    }

    let cancelled = false;

    if (jobId && currentJob?.id !== jobId) {
      setUrlSelectionReady(false);
      void openJob(jobId)
        .catch((loadError) => {
          if (cancelled || isUnauthorizedApiError(loadError)) {
            return;
          }
          setPageError(loadError instanceof Error ? loadError.message : "Impossible d ouvrir le job import");
        })
        .finally(() => {
          if (!cancelled) {
            setUrlSelectionReady(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (!jobId && profileId && selectedProfile?.id !== profileId) {
      setUrlSelectionReady(false);
      setCurrentJob(null);
      void loadProfileDetail(profileId)
        .catch((loadError) => {
          if (cancelled || isUnauthorizedApiError(loadError)) {
            return;
          }
          setPageError(loadError instanceof Error ? loadError.message : "Impossible d ouvrir le profil import");
        })
        .finally(() => {
          if (!cancelled) {
            setUrlSelectionReady(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    setUrlSelectionReady(true);
    return () => {
      cancelled = true;
    };
  }, [currentJob?.id, loadProfileDetail, openJob, searchParams, selectedProfile?.id, token]);

  useEffect(() => {
    if (!urlSelectionReady) {
      return;
    }

    const requestedJobId = searchParams.get("jobId");
    const requestedProfileId = searchParams.get("profileId");
    if (requestedJobId && requestedJobId !== currentJob?.id) {
      return;
    }
    if (!requestedJobId && requestedProfileId && requestedProfileId !== selectedProfile?.id) {
      return;
    }

    const nextPath = buildPathWithQuery(pathname, searchParams, {
      jobId: currentJob?.id ?? null,
      profileId: currentJob ? null : selectedProfile?.id ?? null
    });
    const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextPath !== currentPath) {
      router.replace(nextPath, { scroll: false });
    }
  }, [currentJob?.id, pathname, router, searchParams, selectedProfile?.id, urlSelectionReady]);

  const analyzeIfc4 = useCallback(async () => {
    setBusyAction("ifc-analyze");
    setActionError(null);
    setActionNotice(null);
    setIfcApplyResult(null);
    try {
      const analysis = await apiUpload<Ifc4AnalysisResponse>("/imports/ifc4/analyze", buildIfcFormData());
      setIfcAnalysis(analysis);
      const defaults = analysis.classSummary
        .filter((item) => item.selectedByDefault)
        .map((item) => item.sourceClass);
      if (defaults.length > 0) {
        setIfcSelectedClasses(defaults);
      }
      setIfcSpatialTypeOverrides({});
      const knownPaths = new Set(analysis.spatialNodes.map((node) => node.path));
      setIfcSpatialExpandedPaths(
        analysis.spatialNodes
          .filter((node) => !node.parentPath || !knownPaths.has(node.parentPath))
          .map((node) => node.path)
      );
      setIfcSelectedSpatialPath(null);
      setIfcAssetResourceOverrides({});
      setIfcSpatialPage(1);
      setIfcAssetPage(1);
      setIfcEquipmentPage(1);
      setIfcEquipmentAnomalyPage(1);
      setSelectedIfcEquipment(null);
      setPageError(null);
      setActionNotice(
        `Analyse IFC4 terminee : ${analysis.spatialNodes.length} noeud(s) spatial(aux), ${analysis.equipmentRows.length} equipement(s) candidat(s).`
      );
    } catch (error) {
      setActionError(formatDetailedApiError(error, "Impossible d analyser le fichier IFC4"));
    } finally {
      setBusyAction(null);
    }
  }, [buildIfcFormData]);

  const createIfc4Job = useCallback(
    async (kind: "spatial" | "equipments") => {
      setBusyAction(kind === "spatial" ? "ifc-spatial-job" : "ifc-equipments-job");
      setActionError(null);
      try {
        const result = await apiUpload<Ifc4CreateJobResponse>(
          kind === "spatial" ? "/imports/ifc4/spatial/create-job" : "/imports/ifc4/equipments/create-job",
          buildIfcFormData()
        );
        await openJob(result.job.id);
        const jobs = await loadJobs();
        setJobsResponse(jobs);
        setPageError(null);
        setActionNotice(`Job ${TARGET_DOMAIN_LABELS[result.job.targetDomain]} prepare avec ${result.rowsPrepared} ligne(s).`);
      } catch (error) {
        setActionError(formatDetailedApiError(error, "Impossible de creer le job depuis IFC4"));
      } finally {
        setBusyAction(null);
      }
    },
    [buildIfcFormData, loadJobs, openJob]
  );

  const applyIfc4References = useCallback(async () => {
    setBusyAction("ifc-apply-references");
    setActionError(null);
    try {
      const result = await apiUpload<Ifc4AssetReferencesApplyResult>(
        "/imports/ifc4/asset-references/apply",
        buildIfcFormData()
      );
      setIfcApplyResult(result);
      const analysis = await apiUpload<Ifc4AnalysisResponse>("/imports/ifc4/analyze", buildIfcFormData());
      setIfcAnalysis(analysis);
      setPageError(null);
      setActionNotice(`${result.created.length} reference(s) creee(s), ${result.existing.length} deja existante(s).`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible d appliquer les referentiels IFC4");
    } finally {
      setBusyAction(null);
    }
  }, [buildIfcFormData]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(ifcVisibleSpatialRows.length / IFC_PREVIEW_PAGE_SIZE));
    setIfcSpatialPage((current) => Math.min(current, totalPages));
  }, [ifcVisibleSpatialRows.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(ifcEffectiveAssetRows.length / IFC_PREVIEW_PAGE_SIZE));
    setIfcAssetPage((current) => Math.min(current, totalPages));
  }, [ifcEffectiveAssetRows.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(ifcEquipmentValidationRows.length / IFC_PREVIEW_PAGE_SIZE));
    setIfcEquipmentPage((current) => Math.min(current, totalPages));
  }, [ifcEquipmentValidationRows.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(ifcEquipmentAnomalyRows.length / IFC_PREVIEW_PAGE_SIZE));
    setIfcEquipmentAnomalyPage((current) => Math.min(current, totalPages));
  }, [ifcEquipmentAnomalyRows.length]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        await refreshWorkspaceSafely();
        if (cancelled) {
          return;
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setPageError(null);
          return;
        }
        setPageError(loadError instanceof Error ? loadError.message : "Impossible de charger le workspace imports");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaceSafely, token]);

  useEffect(() => {
    if (fieldCatalog.length === 0) {
      return;
    }

    if (currentJob?.mappings?.length) {
      setMappingDrafts(mergeDrafts(fieldCatalog, currentJob.mappings));
      return;
    }

    if (selectedProfile) {
      setMappingDrafts(mergeDrafts(fieldCatalog, selectedProfile.mappings));
      return;
    }

    setMappingDrafts((current) => (current.length > 0 ? current : mergeDrafts(fieldCatalog, [])));
  }, [currentJob?.mappings, fieldCatalog, selectedProfile]);

  useEffect(() => {
    if (!hasImportsRead || fieldCatalog.length > 0 || !token) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const fields = await apiFetch<ImportTargetFieldDefinition[]>(`/imports/targets/${currentDomain}/fields`);
        if (!cancelled) {
          setFieldCatalog(fields);
        }
      } catch {
        return;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentDomain, fieldCatalog.length, hasImportsRead, token]);

  const runJobAction = async (mode: "preview" | "validate" | "execute") => {
    if (!currentJob) {
      return;
    }
    if (!mappingPayload) {
      setActionError("Le mapping contient un transformConfig invalide");
      return;
    }

    setBusyAction(mode);
    setActionError(null);
    try {
      const payload: RunImportJobInput = {};
      if (selectedProfile && !mappingDirty) {
        payload.profileId = selectedProfile.id;
      } else {
        payload.overrideMappings = mappingPayload;
      }

      const updated = await apiFetch<ImportJobDetail>(`/imports/jobs/${currentJob.id}/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setCurrentJob(updated);
      setPageError(null);
      const jobs = await loadJobs();
      setJobsResponse(jobs);
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : `Impossible de lancer ${mode}`);
    } finally {
      setBusyAction(null);
    }
  };

  const saveProfile = async (mode: "create" | "update") => {
    if (!canPersistProfile || !currentJob) {
      return;
    }
    if (!mappingPayload) {
      setActionError("Le mapping contient un transformConfig invalide");
      return;
    }

    const payload = {
      targetDomain: currentDomain,
      name: profileName.trim(),
      sourceKind: currentJob.sourceKind as ImportSourceKind,
      sheetName: currentJob.sheetName,
      headerRowIndex: currentJob.sourceSnapshot?.headerRowIndex ?? 1,
      mappings: mappingPayload,
      options: currentJob.options ?? null
    };

    if (!payload.name) {
      setActionError("Le nom du profil est obligatoire");
      return;
    }

    setBusyAction(mode === "create" ? "save-profile" : "update-profile");
    setActionError(null);
    try {
      const profile =
        mode === "create"
          ? await apiFetch<ImportProfileDetail>("/imports/profiles", {
              method: "POST",
              body: JSON.stringify(payload)
            })
          : await apiFetch<ImportProfileDetail>(`/imports/profiles/${selectedProfile?.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload)
            });

      setSelectedProfile(profile);
      setSelectedProfileId(profile.id);
      setProfileName(profile.name);
      setPageError(null);
      const profiles = await apiFetch<PaginatedResponse<ImportProfileSummary>>(
        `/imports/profiles${buildQueryString({
          page: 1,
          pageSize: 100,
          targetDomain: currentDomain,
          isArchived: "false",
          sort: "updatedAt",
          direction: "desc"
        })}`
      );
      setProfilesResponse(profiles);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Impossible d enregistrer le profil");
    } finally {
      setBusyAction(null);
    }
  };

  const purgeCreatedData = async (job: ImportJobSummary | ImportJobDetail) => {
    if (!hasImportsManage || !canPurgeJob(job)) {
      return;
    }

    setBusyAction(`purge-${job.id}`);
    setActionError(null);
    setActionNotice(null);
    setPurgeBlocked([]);
    try {
      const result = await apiFetch<ImportJobPurgeCreatedDataResult>(`/imports/jobs/${job.id}/purge-created-data`, {
        method: "POST"
      });
      setPendingPurgeJob(null);
      setPageError(null);
      setPurgeBlocked(result.blocked);

      if (result.status === "BLOCKED") {
        setActionError(`Purge bloquee pour ${result.summary.blockedNodes} element(s).`);
      } else if (result.status === "NO_OP") {
        setActionNotice("Aucune creation metier de ce job n est encore purgeable.");
      } else {
        setActionNotice(formatPurgeSuccess(result));
      }

      const jobs = await loadJobs();
      setJobsResponse(jobs);
      if (currentJob?.id === job.id) {
        const refreshed = await apiFetch<ImportJobDetail>(`/imports/jobs/${job.id}`);
        setCurrentJob(refreshed);
      }
    } catch (purgeError) {
      setActionError(purgeError instanceof Error ? purgeError.message : "Impossible de purger les creations du job");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteJob = async (job: ImportJobSummary | ImportJobDetail) => {
    if (!hasImportsManage || !canDeleteJob(job)) {
      return;
    }

    setBusyAction(`delete-${job.id}`);
    setActionError(null);
    setActionNotice(null);
    try {
      await apiFetch<{ id: string; deleted: true }>(`/imports/jobs/${job.id}`, {
        method: "DELETE"
      });
      setPendingDeleteJob(null);
      setPageError(null);
      setActionNotice("Le job a ete supprime definitivement.");
      if (currentJob?.id === job.id) {
        setCurrentJob(null);
      }
      const jobs = await loadJobs();
      setJobsResponse(jobs);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer le job");
    } finally {
      setBusyAction(null);
    }
  };

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell
      helpDialog={{
        title: "Aide - Imports et exports",
        description:
          "Guide V1 du workspace ETL: workflow global, mapping, permissions, rapport et limites actuelles des exports.",
        triggerLabel: "Afficher l aide imports et exports",
        content: <ImportsHelpPanel />
      }}
    >
      <ListPage
        eyebrow="Flux"
        title="Imports et exports"
        description="Workspace ETL V1 pour charger un fichier, mapper les colonnes, previsualiser, valider puis executer un import."
        filters={
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Domaine actif</p>
                <p className="mt-2 text-base font-semibold text-foreground">{TARGET_DOMAIN_LABELS[currentDomain]}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Profil actif</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {selectedProfileSummary?.name ?? "Aucun profil"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fichier charge</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {currentJob?.originalFilename ?? "Aucun fichier"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Statut job</p>
                <div className="mt-2">
                  {currentJob?.status ? <StatusPill label={currentJob.status} /> : <span className="text-sm text-muted-foreground">Aucun job</span>}
                </div>
              </div>
            </div>
            <FilterBar
              searchValue={jobsQuery.q}
              onSearchChange={(value) => setJobsQuery((current) => ({ ...current, q: value, page: 1 }))}
              searchPlaceholder="Rechercher dans l historique des jobs"
              filters={
                <>
                  <Select
                    value={jobsQuery.targetDomain}
                    onValueChange={(value) =>
                      setJobsQuery((current) => ({
                        ...current,
                        targetDomain: (value as typeof current.targetDomain) ?? "all",
                        page: 1
                      }))
                    }
                  >
                    <SelectTrigger className="min-w-52">
                      <SelectValue placeholder="Tous les domaines" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les domaines</SelectItem>
                      {IMPORT_TARGET_DOMAINS.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {TARGET_DOMAIN_LABELS[domain]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={jobsQuery.status}
                    onValueChange={(value) =>
                      setJobsQuery((current) => ({
                        ...current,
                        status: (value as typeof current.status) ?? "all",
                        page: 1
                      }))
                    }
                  >
                    <SelectTrigger className="min-w-44">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      {IMPORT_JOB_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              actions={
                <Button variant="outline" onClick={() => void refreshWorkspaceSafely()}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
              }
            />
          </div>
        }
        grid={
          <div className="space-y-6">
            {pageError ? <p className="text-sm text-destructive">{pageError}</p> : null}
            {actionError ? <p className="whitespace-pre-line text-sm text-destructive">{actionError}</p> : null}
            {actionNotice ? <p className="text-sm text-emerald-700">{actionNotice}</p> : null}
            {purgeBlocked.length > 0 ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
                <p className="text-sm font-semibold text-red-700">Elements bloques</p>
                <div className="mt-3 space-y-2">
                  {purgeBlocked.map((item) => (
                    <div key={`${item.entityId ?? item.nodeId ?? item.path}-${item.reason}`} className="text-sm text-red-700">
                      <span className="font-mono">{item.targetKey ?? item.path}</span>
                      {" - "}
                      {item.reason === "HAS_FOREIGN_DESCENDANTS"
                        ? "descendants externes detectes"
                        : item.reason === "HAS_SCOPE_ASSIGNMENTS"
                          ? "affectations IAM actives"
                          : item.reason === "HAS_LINKED_EQUIPMENTS"
                            ? "equipements rattaches"
                            : "affectations externes actives"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {!hasImportsRead && me ? (
              <PageSection title="Acces refuse" description="Votre compte ne dispose pas du droit imports.read.">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-4">
                  <ShieldAlertIcon className="size-5 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    Le workspace imports est visible dans la navigation, mais ce compte ne peut pas consulter les jobs et les profils.
                  </p>
                </div>
              </PageSection>
            ) : null}
            {hasImportsRead ? (
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_430px]">
                <div className="space-y-6">
                  <PageSection
                    title="Assistant IFC4"
                    description="Extraire le spatial, preparer les referentiels assets et generer des jobs equipements depuis un fichier IFC4."
                  >
                    <div className="space-y-5">
                      <FormSection title="1. Fichier IFC4" description="Selection du fichier source a analyser." className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="outline"
                            disabled={!hasImportsManage || busyAction !== null}
                            onClick={() => ifcFileInputRef.current?.click()}
                          >
                            <FileUpIcon className="size-4" />
                            Choisir un fichier IFC
                          </Button>
                          {ifcFile ? (
                            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-sm">
                              <span className="truncate font-medium text-foreground">{ifcFile.name}</span>
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                  setIfcFile(null);
                                  setIfcAnalysis(null);
                                  setIfcApplyResult(null);
                                  setIfcSpatialTypeOverrides({});
                                  setIfcSpatialExpandedPaths([]);
                                  setIfcSelectedSpatialPath(null);
                                  setIfcAssetResourceOverrides({});
                                  setIfcEquipmentPropertyMappings(DEFAULT_IFC_EQUIPMENT_PROPERTY_MAPPINGS);
                                  setIfcSpatialPage(1);
                                  setIfcAssetPage(1);
                                  setIfcEquipmentPage(1);
                                  setIfcEquipmentAnomalyPage(1);
                                  setSelectedIfcEquipment(null);
                                  setActionNotice(null);
                                  setActionError(null);
                                }}
                                aria-label="Retirer le fichier IFC selectionne"
                              >
                                <XIcon className="size-4" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Aucun fichier selectionne</span>
                          )}
                          <input
                            ref={ifcFileInputRef}
                            type="file"
                            accept=".ifc"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setIfcFile(file);
                              setIfcAnalysis(null);
                              setIfcApplyResult(null);
                              setIfcSpatialTypeOverrides({});
                              setIfcSpatialExpandedPaths([]);
                              setIfcSelectedSpatialPath(null);
                              setIfcAssetResourceOverrides({});
                              setIfcEquipmentPropertyMappings(DEFAULT_IFC_EQUIPMENT_PROPERTY_MAPPINGS);
                              setIfcSpatialPage(1);
                              setIfcAssetPage(1);
                              setIfcEquipmentPage(1);
                              setIfcEquipmentAnomalyPage(1);
                              setSelectedIfcEquipment(null);
                              setActionNotice(null);
                              setActionError(null);
                              event.target.value = "";
                            }}
                          />
                        </div>
                      </FormSection>

                      <FormSection title="2. Previsualisation" description="Analyse du fichier avant creation des jobs imports." className="p-4" columns={1}>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            disabled={!hasImportsManage || !ifcFile || busyAction !== null}
                            onClick={() => void analyzeIfc4()}
                          >
                            <EyeIcon className="size-4" />
                            Previsualiser
                          </Button>
                          {ifcAnalysis ? (
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{ifcAnalysis.schema ?? "IFC"}</Badge>
                              <Badge variant="outline">{formatNumber(ifcAnalysis.totalEntities)} entite(s)</Badge>
                              <Badge variant="outline">{formatNumber(ifcAnalysis.spatialNodes.length)} noeud(s)</Badge>
                              <Badge variant="outline">{formatNumber(ifcAnalysis.equipmentRows.length)} equipement(s)</Badge>
                              {ifcAnalysis.geometrySummary ? (
                                <>
                                  <Badge variant="outline">{formatNumber(ifcAnalysis.geometrySummary.ready)} geometrie(s) OK</Badge>
                                  <Badge variant={ifcAnalysis.geometrySummary.missing + ifcAnalysis.geometrySummary.errors > 0 ? "destructive" : "outline"}>
                                    {formatNumber(ifcAnalysis.geometrySummary.missing + ifcAnalysis.geometrySummary.errors)} geometrie(s) a corriger
                                  </Badge>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">La previsualisation apparaitra apres analyse.</span>
                          )}
                        </div>
                      </FormSection>

                      {ifcAnalysis ? (
                        <div className="space-y-5">
                          <FormSection title="3. Spatial" description="Noeuds qui seront convertis en job spatial-nodes." className="p-4" columns={1}>
                            <div className="space-y-2">
                              {ifcVisibleSpatialRows.length === 0 ? (
                                <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-5">
                                  <p className="font-medium text-foreground">Aucun noeud spatial</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Aucun noeud spatial exploitable n a ete extrait.
                                  </p>
                                </div>
                              ) : null}
                              {pagedIfcSpatialRows.map((item) => {
                                const effectiveType = (ifcSpatialTypeOverrides[item.path] ?? item.type) as SpatialNodeType;
                                const isExpanded = ifcSpatialExpandedPaths.includes(item.path);
                                const isSelected = ifcSelectedSpatialPath === item.path;
                                const attachedEquipmentRows = ifcEquipmentRowsBySpatialPath.get(item.path) ?? [];

                                return (
                                  <div
                                    key={item.path}
                                    className="rounded-xl border border-border/60 bg-background/70 transition-colors hover:bg-muted/30"
                                  >
                                    <div className="flex flex-col gap-3 px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
                                      <div
                                        className="min-w-0 flex-1"
                                        style={{ paddingLeft: `${item.depth * 16}px` }}
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <button
                                            type="button"
                                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                                            disabled={!item.hasChildren}
                                            aria-label={
                                              item.hasChildren
                                                ? isExpanded
                                                  ? "Replier les enfants"
                                                  : "Deployer les enfants"
                                                : "Aucun enfant"
                                            }
                                            onClick={() =>
                                              setIfcSpatialExpandedPaths((current) =>
                                                current.includes(item.path)
                                                  ? current.filter((path) => path !== item.path)
                                                  : [...current, item.path]
                                              )
                                            }
                                          >
                                            {item.hasChildren ? (
                                              isExpanded ? (
                                                <ChevronDownIcon className="size-4" />
                                              ) : (
                                                <ChevronRightIcon className="size-4" />
                                              )
                                            ) : (
                                              <span className="size-4" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            className="min-w-0 flex-1 text-left"
                                            onClick={() =>
                                              setIfcSelectedSpatialPath((current) =>
                                                current === item.path ? null : item.path
                                              )
                                            }
                                          >
                                            <SpatialNodeTitle
                                              type={effectiveType}
                                              label={item.label}
                                              path={item.path}
                                              settings={displaySettings}
                                              className="min-w-0"
                                            />
                                          </button>
                                        </div>
                                        <p className="ml-9 mt-1 text-xs text-muted-foreground">
                                          {effectiveType}
                                          {item.parentPath ? ` - parent ${item.parentPath}` : " - racine"}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                                        <Badge variant={geometryBadgeVariant(item.geometry?.geometryStatus)}>
                                          {geometryBadgeLabel(item.geometry?.geometryStatus)}
                                        </Badge>
                                        <SpatialNodeChip type={effectiveType} label={effectiveType} settings={displaySettings} />
                                        <Select
                                          value={effectiveType}
                                          onValueChange={(value) =>
                                            setIfcSpatialTypeOverrides((current) => ({
                                              ...current,
                                              [item.path]: (value as SpatialNodeType) ?? item.type
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="w-40">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {IFC_SPATIAL_TYPES.map((type) => (
                                              <SelectItem key={`${item.path}-${type}`} value={type}>
                                                {type}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    {isSelected ? (
                                      <div className="border-t border-border/60 px-4 py-4">
                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                          <ReadOnlyField label="Code" value={item.code} />
                                          <ReadOnlyField label="Parent" value={item.parentPath ?? "Racine"} />
                                          <ReadOnlyField label="Enfants" value={formatNumber(item.childrenCount)} />
                                          <ReadOnlyField label="Classe source" value={item.sourceClass ?? "-"} />
                                          <ReadOnlyField label="Chemin" value={item.path} />
                                          <ReadOnlyField label="Reference externe" value={item.externalRef ?? "-"} />
                                          <ReadOnlyField label="Geometrie" value={geometryBadgeLabel(item.geometry?.geometryStatus)} />
                                          <ReadOnlyField label="Dimensions XYZ" value={geometrySizeLabel(item.geometry)} />
                                        </div>
                                      </div>
                                    ) : null}
                                    {isExpanded && attachedEquipmentRows.length > 0 ? (
                                      <div className="border-t border-border/60 bg-muted/10 px-4 py-4">
                                        <div
                                          className="space-y-2"
                                          style={{ paddingLeft: `${(item.depth + 1) * 16}px` }}
                                        >
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">{formatNumber(attachedEquipmentRows.length)} equipement(s)</Badge>
                                            <span className="text-sm text-muted-foreground">
                                              Equipements candidats rattaches a ce noeud avant validation du job.
                                            </span>
                                          </div>
                                          {attachedEquipmentRows.map((equipment) => (
                                            <IfcEquipmentValidationCard
                                              key={`${equipment.sourceClass}-${equipment.internalCode}-${equipment.rowIndex}`}
                                              item={equipment}
                                              onOpen={setSelectedIfcEquipment}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                            {ifcVisibleSpatialRows.length > IFC_PREVIEW_PAGE_SIZE ? (
                              <div className="mt-4">
                                <PaginationBar
                                  page={ifcSpatialPage}
                                  pageSize={IFC_PREVIEW_PAGE_SIZE}
                                  total={ifcVisibleSpatialRows.length}
                                  pageSizeOptions={[IFC_PREVIEW_PAGE_SIZE]}
                                  onPageChange={setIfcSpatialPage}
                                  onPageSizeChange={() => setIfcSpatialPage(1)}
                                />
                              </div>
                            ) : null}
                            <div className="mt-4 flex justify-end">
                              <Button
                                variant="outline"
                                disabled={!hasImportsManage || !ifcAnalysis || hasIfcGeometryBlockingErrors || busyAction !== null}
                                onClick={() => void createIfc4Job("spatial")}
                              >
                                Creer job spatial
                              </Button>
                            </div>
                          </FormSection>

                          <FormSection title="4. Referentiels assets" description="References candidates detectees dans les proprietes IFC." className="p-4" columns={1}>
                            <DataGrid
                              rows={pagedIfcAssetRows}
                              columns={[
                                {
                                  key: "resource",
                                  label: "Referentiel",
                                  render: (item) => {
                                    const key = `${item.resource}:${item.code}`;
                                    const resource = ifcAssetResourceOverrides[key] ?? item.effectiveResource;
                                    return <Badge variant="outline">{IFC_ASSET_REFERENCE_LABELS[resource]}</Badge>;
                                  }
                                },
                                {
                                  key: "code",
                                  label: "Reference",
                                  render: (item) => (
                                    <div className="min-w-72">
                                      <p className="font-medium text-foreground">{item.label}</p>
                                      <p className="font-mono text-xs text-muted-foreground">{item.code}</p>
                                    </div>
                                  )
                                },
                                {
                                  key: "details",
                                  label: "Details",
                                  render: (item) => (
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                      <p>
                                        <span className="font-medium text-foreground">Parent :</span>{" "}
                                        <span className="font-mono text-xs">{item.parentCode ?? "-"}</span>
                                      </p>
                                      <p>
                                        <span className="font-medium text-foreground">Occurrences :</span>{" "}
                                        {formatNumber(item.count)}
                                      </p>
                                      <p>
                                        <span className="font-medium text-foreground">Source :</span>{" "}
                                        {item.sourceClass ?? "-"}
                                      </p>
                                    </div>
                                  )
                                },
                                {
                                  key: "status",
                                  label: "Etat",
                                  render: (item) => (
                                    <Badge variant={item.exists ? "outline" : "secondary"}>
                                      {item.exists ? "Existant" : "A creer"}
                                    </Badge>
                                  )
                                },
                                {
                                  key: "editResource",
                                  label: "Correction type",
                                  render: (item) => {
                                    const key = `${item.resource}:${item.code}`;
                                    return (
                                      <Select
                                        value={ifcAssetResourceOverrides[key] ?? item.resource}
                                        onValueChange={(value) =>
                                          setIfcAssetResourceOverrides((current) => ({
                                            ...current,
                                            [key]: (value as Ifc4AssetReferenceCandidate["resource"]) ?? item.resource
                                          }))
                                        }
                                      >
                                        <SelectTrigger className="w-44">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {IFC_ASSET_REFERENCE_RESOURCES.map((resource) => (
                                            <SelectItem key={`${key}-${resource}`} value={resource}>
                                              {IFC_ASSET_REFERENCE_LABELS[resource]}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    );
                                  }
                                }
                              ]}
                              getRowId={(item) => `${item.resource}-${item.code}-${item.parentCode ?? "root"}`}
                              getMobileTitle={(item) => item.label}
                              getMobileDescription={(item) => `${IFC_ASSET_REFERENCE_LABELS[item.effectiveResource]} - ${item.code}`}
                              getMobileMeta={(item) => (
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <p>Parent : {item.parentCode ?? "-"}</p>
                                  <p>Occurrences : {formatNumber(item.count)}</p>
                                  <p>Source : {item.sourceClass ?? "-"}</p>
                                  <p>Etat : {item.exists ? "Existant" : "A creer"}</p>
                                </div>
                              )}
                              emptyTitle="Aucune reference"
                              emptyDescription="Aucune reference asset candidate n a ete detectee."
                            />
                            {ifcAssetRows.length > IFC_PREVIEW_PAGE_SIZE ? (
                              <div className="mt-4">
                                <PaginationBar
                                  page={ifcAssetPage}
                                  pageSize={IFC_PREVIEW_PAGE_SIZE}
                                  total={ifcAssetRows.length}
                                  pageSizeOptions={[IFC_PREVIEW_PAGE_SIZE]}
                                  onPageChange={setIfcAssetPage}
                                  onPageSizeChange={() => setIfcAssetPage(1)}
                                />
                              </div>
                            ) : null}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              {ifcApplyResult ? (
                                <p className="text-sm text-muted-foreground">
                                  Derniere application : {formatNumber(ifcApplyResult.created.length)} creee(s),{" "}
                                  {formatNumber(ifcApplyResult.skipped.length)} ignoree(s).
                                </p>
                              ) : <span />}
                              <Button
                                variant="outline"
                                disabled={!hasImportsManage || !ifcAnalysis || ifcMissingReferences.length === 0 || busyAction !== null}
                                onClick={() => void applyIfc4References()}
                              >
                                Appliquer referentiels
                              </Button>
                            </div>
                          </FormSection>

                          <FormSection title="5. Equipements" description="Lignes candidates pour le job equipments." className="p-4" columns={1}>
                            <div className="mb-4 grid gap-4 lg:grid-cols-2">
                              <Field label="Statut par defaut">
                                <Input
                                  value={ifcDefaultStatusCode}
                                  onChange={(event) => setIfcDefaultStatusCode(event.target.value)}
                                />
                              </Field>
                              <Field label="Proprietaire par defaut">
                                <Input
                                  value={ifcDefaultOwnerCode}
                                  onChange={(event) => setIfcDefaultOwnerCode(event.target.value)}
                                />
                              </Field>
                            </div>
                            {ifcEquipmentClassOptions.length > 0 ? (
                              <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {ifcEquipmentClassOptions.map((item) => (
                                  <label
                                    key={item.sourceClass}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                                  >
                                    <span>
                                      <span className="font-semibold text-foreground">{item.sourceClass}</span>
                                      <span className="ml-2 text-muted-foreground">{formatNumber(item.count)}</span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={ifcSelectedClasses.includes(item.sourceClass)}
                                      onChange={(event) =>
                                        setIfcSelectedClasses((current) =>
                                          event.target.checked
                                            ? [...new Set([...current, item.sourceClass])]
                                            : current.filter((sourceClass) => sourceClass !== item.sourceClass)
                                        )
                                      }
                                    />
                                  </label>
                                ))}
                              </div>
                            ) : null}
                            <div className="mb-4 rounded-xl border border-border/60 bg-background/70 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <p className="font-semibold text-foreground">Mapping des proprietes IFC</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Associe les proprietes IfcPropertySingleValue detectees aux champs metier equipement,
                                    puis clique sur Actualiser le mapping pour recalculer la preview.
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  disabled={!hasImportsManage || !ifcFile || busyAction !== null}
                                  onClick={() => void analyzeIfc4()}
                                >
                                  <RefreshCwIcon className="size-4" />
                                  Actualiser le mapping
                                </Button>
                              </div>
                              {ifcPropertyCandidates.length === 0 ? (
                                <p className="mt-4 text-sm text-muted-foreground">
                                  Aucune propriete IfcPropertySingleValue exploitable n a ete detectee pour les classes selectionnees.
                                </p>
                              ) : (
                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  {IFC_EQUIPMENT_PROPERTY_MAPPING_FIELDS.map((field) => {
                                    const value = ifcEquipmentPropertyMappings[field.key] ?? NONE_VALUE;
                                    const selectedCandidate = ifcPropertyCandidates.find((candidate) => candidate.name === value);
                                    return (
                                      <Field key={field.key} label={field.label}>
                                        <Select
                                          value={value}
                                          onValueChange={(nextValue) =>
                                            setIfcEquipmentPropertyMappings((current) => ({
                                              ...current,
                                              [field.key]: nextValue === NONE_VALUE ? null : nextValue
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choisir une propriete" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={NONE_VALUE}>Aucune</SelectItem>
                                            {ifcPropertyCandidates.map((candidate) => (
                                              <SelectItem key={`${field.key}-${candidate.name}`} value={candidate.name}>
                                                {propertyCandidateLabel(candidate)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {selectedCandidate
                                            ? `Exemple : ${selectedCandidate.sampleValue ?? "-"} - ${formatNumber(selectedCandidate.count)} occurrence(s)`
                                            : field.description}
                                        </p>
                                      </Field>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="mb-4 grid gap-3 md:grid-cols-3">
                              <ReadOnlyField label="Equipements candidats" value={formatNumber(ifcEquipmentValidationRows.length)} />
                              <ReadOnlyField
                                label="Rattaches a l arbre"
                                value={formatNumber(ifcEquipmentValidationRows.length - ifcEquipmentAnomalyRows.length)}
                              />
                              <ReadOnlyField label="Anomalies de rattachement" value={formatNumber(ifcEquipmentAnomalyRows.length)} />
                            </div>
                            <DataGrid
                              rows={pagedIfcEquipmentRows}
                              columns={[
                                {
                                  key: "equipment",
                                  label: "Equipement",
                                  render: (item) => (
                                    <div>
                                      <p className="font-medium text-foreground">{item.label ?? item.internalCode}</p>
                                      <p className="font-mono text-xs text-muted-foreground">{item.internalCode}</p>
                                      {item.numPiece ? <p className="text-xs text-muted-foreground">Piece : {item.numPiece}</p> : null}
                                    </div>
                                  )
                                },
                                {
                                  key: "component",
                                  label: "Composant asset",
                                  render: (item) => (
                                    <div className="space-y-1 text-sm">
                                      <p className="font-medium text-foreground">{compactReferenceValue(item.classification.type)}</p>
                                      <p className="text-muted-foreground">
                                        {compactReferenceValue(item.classification.category)} / {compactReferenceValue(item.classification.family)}
                                      </p>
                                    </div>
                                  )
                                },
                                {
                                  key: "model",
                                  label: "Marque / Modele",
                                  render: (item) => (
                                    <span className="text-sm text-muted-foreground">
                                      {compactReferenceValue(item.classification.brand)} / {compactReferenceValue(item.classification.model)}
                                    </span>
                                  )
                                },
                                {
                                  key: "owner",
                                  label: "Statut / Proprietaire",
                                  render: (item) => (
                                    <span className="text-sm text-muted-foreground">
                                      {compactReferenceValue(item.classification.status)} / {compactReferenceValue(item.classification.owner)}
                                    </span>
                                  )
                                },
                                {
                                  key: "spatial",
                                  label: "Noeud spatial parent",
                                  render: (item) => (
                                    <div className="space-y-1 text-sm">
                                      <p className="font-medium text-foreground">{item.spatialNode?.label ?? "-"}</p>
                                      <p className="font-mono text-xs text-muted-foreground">{item.currentSpatialPath ?? "-"}</p>
                                    </div>
                                  )
                                },
                                {
                                  key: "status",
                                  label: "Rattachement",
                                  render: (item) => (
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant={item.isSpatiallyAttached ? "outline" : "destructive"}>
                                        {item.isSpatiallyAttached ? "Dans l arbre" : "Anomalie"}
                                      </Badge>
                                      <Badge variant={geometryBadgeVariant(item.geometry?.geometryStatus)}>
                                        {geometryBadgeLabel(item.geometry?.geometryStatus)}
                                      </Badge>
                                    </div>
                                  )
                                }
                              ]}
                              getRowId={(item) => `${item.sourceClass}-${item.internalCode}-${item.rowIndex}`}
                              getMobileTitle={(item) => item.label ?? item.internalCode}
                              getMobileDescription={(item) => `${compactReferenceValue(item.classification.type)} - ${item.currentSpatialPath ?? "sans localisation"}`}
                              getMobileMeta={(item) => (
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <p>Code : {item.internalCode}</p>
                                  <p>Piece : {item.numPiece ?? "-"}</p>
                                  <p>Reference externe : {item.externalRef ?? "-"}</p>
                                  <p>Geometrie : {geometryBadgeLabel(item.geometry?.geometryStatus)}</p>
                                  <p>Dimensions XYZ : {geometrySizeLabel(item.geometry)}</p>
                                  <p>Statut / proprietaire : {compactReferenceValue(item.classification.status)} / {compactReferenceValue(item.classification.owner)}</p>
                                  <p>Rattachement : {item.isSpatiallyAttached ? "Dans l arbre" : item.anomalyReasons.join(" ")}</p>
                                </div>
                              )}
                              onRowClick={(item) => setSelectedIfcEquipment(item)}
                              emptyTitle="Aucun equipement"
                              emptyDescription="Aucun equipement candidat n a ete extrait des classes selectionnees."
                            />
                            {ifcEquipmentValidationRows.length > IFC_PREVIEW_PAGE_SIZE ? (
                              <div className="mt-4">
                                <PaginationBar
                                  page={ifcEquipmentPage}
                                  pageSize={IFC_PREVIEW_PAGE_SIZE}
                                  total={ifcEquipmentValidationRows.length}
                                  pageSizeOptions={[IFC_PREVIEW_PAGE_SIZE]}
                                  onPageChange={setIfcEquipmentPage}
                                  onPageSizeChange={() => setIfcEquipmentPage(1)}
                                />
                              </div>
                            ) : null}
                            <div className="mt-5 rounded-xl border border-border/60 bg-background/70 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-foreground">Anomalies non rattachees a l arborescence</p>
                                  <p className="text-sm text-muted-foreground">
                                    Equipements sans noeud spatial resolu dans la previsualisation. Ils doivent etre corriges avant generation du job.
                                  </p>
                                </div>
                                <Badge variant={ifcEquipmentAnomalyRows.length > 0 ? "destructive" : "outline"}>
                                  {formatNumber(ifcEquipmentAnomalyRows.length)} anomalie(s)
                                </Badge>
                              </div>
                              {ifcEquipmentAnomalyRows.length === 0 ? (
                                <p className="mt-4 text-sm text-muted-foreground">
                                  Aucun equipement non rattache. Les candidats localises sont visibles sous leur noeud spatial dans la section 3.
                                </p>
                              ) : (
                                <div className="mt-4 space-y-3">
                                  {pagedIfcEquipmentAnomalyRows.map((item) => (
                                    <IfcEquipmentValidationCard
                                      key={`anomaly-${item.sourceClass}-${item.internalCode}-${item.rowIndex}`}
                                      item={item}
                                      onOpen={setSelectedIfcEquipment}
                                    />
                                  ))}
                                  {ifcEquipmentAnomalyRows.length > IFC_PREVIEW_PAGE_SIZE ? (
                                    <PaginationBar
                                      page={ifcEquipmentAnomalyPage}
                                      pageSize={IFC_PREVIEW_PAGE_SIZE}
                                      total={ifcEquipmentAnomalyRows.length}
                                      pageSizeOptions={[IFC_PREVIEW_PAGE_SIZE]}
                                      onPageChange={setIfcEquipmentAnomalyPage}
                                      onPageSizeChange={() => setIfcEquipmentAnomalyPage(1)}
                                    />
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="mt-4 flex justify-end">
                              <Button
                                variant="outline"
                                disabled={!hasImportsManage || !ifcAnalysis || ifcSelectedClasses.length === 0 || hasIfcGeometryBlockingErrors || busyAction !== null}
                                onClick={() => void createIfc4Job("equipments")}
                              >
                                Creer job equipements
                              </Button>
                            </div>
                          </FormSection>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Charge un fichier `.ifc`, puis lance l analyse pour afficher les previews spatial, referentiels et equipements.
                        </p>
                      )}
                    </div>
                  </PageSection>

                  <PageSection
                    title="Preview source"
                    description="Apercu des en-tetes et des premieres lignes du fichier charge."
                    actions={
                      currentJob?.sourceSnapshot ? (
                        <Badge variant="outline">{formatNumber(currentJob.sourceSnapshot.rowCount)} ligne(s)</Badge>
                      ) : null
                    }
                  >
                    {currentPreviewRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun fichier charge pour le job courant.</p>
                    ) : (
                      <DataGrid
                        rows={reportPreviewRows}
                        columns={[
                          {
                            key: "rowIndex",
                            label: "Ligne",
                            render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.rowIndex}</span>
                          },
                          ...currentHeaders.map((header) => ({
                            key: header,
                            label: header,
                            render: (item: (typeof reportPreviewRows)[number]) => (
                              <span className="text-sm text-muted-foreground">{item.values[header] ?? "-"}</span>
                            )
                          }))
                        ]}
                        getRowId={(item) => item.id}
                        getMobileTitle={(item) => `Ligne ${item.rowIndex}`}
                        getMobileDescription={(item) =>
                          currentHeaders
                            .slice(0, 2)
                            .map((header) => item.values[header] ?? "-")
                            .join(" | ")
                        }
                        getMobileMeta={(item) => (
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {currentHeaders.slice(0, 4).map((header) => (
                              <p key={`${item.id}-${header}`}>
                                <span className="font-medium text-foreground">{header}</span>: {item.values[header] ?? "-"}
                              </p>
                            ))}
                          </div>
                        )}
                        emptyTitle="Aucune ligne source"
                        emptyDescription="Charge un fichier pour afficher l apercu source."
                      />
                    )}
                  </PageSection>

                  <PageSection
                    title="Mapping inline"
                    description="Associe les colonnes source aux champs cibles, puis ajuste les transformations simples."
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        {domainIsExecutable ? (
                          <Badge variant="outline">Domaine actif</Badge>
                        ) : (
                          <Badge variant="outline">Non disponible dans cette vague</Badge>
                        )}
                        {mappingDirty ? <Badge variant="outline">Mapping modifie</Badge> : null}
                      </div>
                    }
                  >
                    {fieldCatalog.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chargement du catalogue de champs cibles...</p>
                    ) : (
                      <div className="space-y-4">
                        {mappingDrafts.map((draft) => (
                          <FormSection
                            key={draft.key}
                            title={draft.label}
                            description={draft.description ?? "Champ cible du domaine d import."}
                            className="p-4 md:p-5"
                          >
                            <Field label="Champ cible">
                              <Input value={draft.targetField} readOnly />
                            </Field>
                            <Field label="Colonne source">
                              <Select
                                value={draft.sourceColumn || NONE_VALUE}
                                onValueChange={(value) =>
                                  setMappingDrafts((current) =>
                                    current.map((item) =>
                                      item.key === draft.key
                                        ? {
                                            ...item,
                                            sourceColumn:
                                              (value ?? NONE_VALUE) === NONE_VALUE ? "" : (value ?? "")
                                          }
                                        : item
                                    )
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choisir une colonne" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE_VALUE}>Aucune colonne</SelectItem>
                                  {currentHeaders.map((header) => (
                                    <SelectItem key={`${draft.key}-${header}`} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="Transformation">
                              <Select
                                value={draft.transformType}
                                onValueChange={(value) =>
                                  setMappingDrafts((current) =>
                                    current.map((item) =>
                                      item.key === draft.key
                                        ? {
                                            ...item,
                                            transformType: (value as MappingDraft["transformType"]) ?? item.transformType
                                          }
                                        : item
                                    )
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMPORT_TRANSFORM_TYPES.map((transformType) => (
                                    <SelectItem key={`${draft.key}-${transformType}`} value={transformType}>
                                      {transformType}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="transformConfig">
                              <Input
                                value={draft.transformConfigText}
                                onChange={(event) =>
                                  setMappingDrafts((current) =>
                                    current.map((item) =>
                                      item.key === draft.key
                                        ? { ...item, transformConfigText: event.target.value }
                                        : item
                                    )
                                  )
                                }
                                placeholder={draft.transformType === "CONSTANT" ? "Valeur simple ou objet JSON" : "Objet JSON optionnel"}
                              />
                            </Field>
                            <Field label="Obligatoire" className="lg:col-span-2">
                              <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                                <input
                                  checked={draft.isRequired}
                                  type="checkbox"
                                  onChange={(event) =>
                                    setMappingDrafts((current) =>
                                      current.map((item) =>
                                        item.key === draft.key
                                          ? { ...item, isRequired: event.target.checked }
                                          : item
                                      )
                                    )
                                  }
                                />
                                <span>
                                  {draft.required
                                    ? "Champ obligatoire du domaine"
                                    : "Rendre ce mapping obligatoire pour ce profil"}
                                </span>
                              </label>
                            </Field>
                          </FormSection>
                        ))}
                      </div>
                    )}
                  </PageSection>

                  <PageSection
                    title="Rapport de traitement"
                    description="Resume du dernier preview, validate ou execute lance sur le job courant."
                    actions={
                      currentReport ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{currentReport.mode}</Badge>
                          <Badge variant="outline">{formatNumber(currentReport.summary.rowsRead)} ligne(s)</Badge>
                        </div>
                      ) : null
                    }
                  >
                    {!currentReport ? (
                      <p className="text-sm text-muted-foreground">Aucun rapport disponible pour le job courant.</p>
                    ) : (
                      <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                          <ReadOnlyField label="Lignes lues" value={formatNumber(currentReport.summary.rowsRead)} />
                          <ReadOnlyField label="Lignes valides" value={formatNumber(currentReport.summary.rowsValid)} />
                          <ReadOnlyField label="Lignes rejetees" value={formatNumber(currentReport.summary.rowsRejected)} />
                          <ReadOnlyField label="Warnings" value={formatNumber(currentReport.summary.rowsWithWarnings)} />
                          <ReadOnlyField label="Ecritures simulees" value={formatNumber(currentReport.summary.simulatedWrites)} />
                          <ReadOnlyField label="Ecritures appliquees" value={formatNumber(currentReport.summary.appliedWrites)} />
                        </div>
                        <DataGrid
                          rows={reportRows}
                          columns={[
                            {
                              key: "rowIndex",
                              label: "Ligne",
                              render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.rowIndex}</span>
                            },
                            {
                              key: "status",
                              label: "Statut",
                              render: (item) => <StatusPill label={item.status} />
                            },
                            {
                              key: "resolvedTargetKey",
                              label: "Cle resolue",
                              render: (item) => (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {item.resolvedTargetKey ?? "-"}
                                </span>
                              )
                            },
                            {
                              key: "messages",
                              label: "Messages",
                              render: (item) => (
                                <div className="flex flex-wrap gap-2">
                                  {item.messages.length === 0 ? (
                                    <span className="text-sm text-muted-foreground">Aucun message</span>
                                  ) : (
                                    item.messages.map((message) => (
                                      <span
                                        key={`${item.rowIndex}-${message}`}
                                        className={
                                          message === "OPERATION_CREATE"
                                            ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700"
                                            : message === "OPERATION_UPDATE"
                                              ? "rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-700"
                                              : "rounded-full border border-border/60 bg-background/70 px-2 py-1 text-xs text-muted-foreground"
                                        }
                                      >
                                        {message}
                                      </span>
                                    ))
                                  )}
                                </div>
                              )
                            }
                          ]}
                          getRowId={(item) => `${item.rowIndex}-${item.status}-${item.resolvedTargetKey ?? "none"}`}
                          getMobileTitle={(item) => `Ligne ${item.rowIndex}`}
                          getMobileDescription={(item) => item.resolvedTargetKey ?? "Cle non resolue"}
                          getMobileMeta={(item) => (
                            <div className="space-y-2">
                              <StatusPill label={item.status} />
                              <div className="flex flex-wrap gap-2">
                                {item.messages.map((message) => (
                                  <span
                                    key={`${item.rowIndex}-mobile-${message}`}
                                    className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-xs text-muted-foreground"
                                  >
                                    {message}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          emptyTitle="Aucune ligne de rapport"
                          emptyDescription="Lance un preview ou une validation pour generer un rapport."
                        />
                      </div>
                    )}
                  </PageSection>
                </div>

                <div className="space-y-6">
                  <PageSection
                    title="Pilotage du job"
                    description="Creation, upload, reprise et execution du job courant."
                  >
                    <div className="space-y-4">
                      <Field label="Domaine cible">
                        <Select
                          value={currentDomain}
                          onValueChange={(value) => {
                            const nextDomain = (value as ImportTargetDomain) ?? "spatial-nodes";
                            setCurrentDomain(nextDomain);
                            setCurrentJob(null);
                            setFieldCatalog([]);
                            setMappingDrafts([]);
                            setSelectedProfile(null);
                            setSelectedProfileId("none");
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPORT_TARGET_DOMAINS.map((domain) => (
                              <SelectItem key={domain} value={domain}>
                                {TARGET_DOMAIN_LABELS[domain]}
                                {EXECUTABLE_DOMAINS.has(domain) ? "" : " - non disponible"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={!hasImportsManage || !domainIsExecutable || busyAction === "create-job"}
                          onClick={async () => {
                            setBusyAction("create-job");
                            setActionError(null);
                            try {
                              const created = await apiFetch<ImportJobDetail>("/imports/jobs", {
                                method: "POST",
                                body: JSON.stringify({ targetDomain: currentDomain })
                              });
                              setCurrentJob(created);
                              setPageError(null);
                              setSelectedProfile(null);
                              setSelectedProfileId("none");
                              const jobs = await loadJobs();
                              setJobsResponse(jobs);
                            } catch (createError) {
                              setActionError(createError instanceof Error ? createError.message : "Impossible de creer le job");
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                        >
                          <FolderInputIcon className="size-4" />
                          Creer un job
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canUpload || busyAction === "upload"}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileUpIcon className="size-4" />
                          Uploader un fichier
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file || !currentJob) {
                              return;
                            }

                            setBusyAction("upload");
                            setActionError(null);
                            try {
                              const formData = new FormData();
                              formData.append("file", file);
                              const updated = await apiUpload<ImportJobDetail>(`/imports/jobs/${currentJob.id}/upload`, formData);
                              setCurrentJob(updated);
                              setPageError(null);
                              const jobs = await loadJobs();
                              setJobsResponse(jobs);
                            } catch (uploadError) {
                              setActionError(uploadError instanceof Error ? uploadError.message : "Impossible d uploader le fichier");
                            } finally {
                              event.target.value = "";
                              setBusyAction(null);
                            }
                          }}
                        />
                      </div>

                      {!domainIsExecutable ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                          Le domaine {TARGET_DOMAIN_LABELS[currentDomain]} reste visible pour preparer la suite, mais son execution reelle n est pas encore branchee.
                        </div>
                      ) : null}

                      <div className="grid gap-3">
                        <ReadOnlyField label="Job courant" value={currentJob?.id ?? "Aucun"} />
                        <ReadOnlyField label="Source" value={currentJob?.sourceKind ?? "-"} />
                        <ReadOnlyField label="Feuille" value={currentJob?.sheetName ?? "-"} />
                        <ReadOnlyField label="Statut" value={currentJob?.status ?? "-"} />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!canRun || busyAction !== null}
                          onClick={() => void runJobAction("preview")}
                        >
                          <EyeIcon className="size-4" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canRun || busyAction !== null}
                          onClick={() => void runJobAction("validate")}
                        >
                          <CheckCircle2Icon className="size-4" />
                          Validate
                        </Button>
                        <Button
                          disabled={!canRun || busyAction !== null}
                          onClick={() => void runJobAction("execute")}
                        >
                          <PlayIcon className="size-4" />
                          Execute
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!hasImportsManage || !currentJob || TERMINAL_JOB_STATUSES.has(currentJob.status) || busyAction !== null}
                          onClick={async () => {
                            if (!currentJob) {
                              return;
                            }
                            setBusyAction("cancel");
                            setActionError(null);
                            try {
                              const updated = await apiFetch<ImportJobDetail>(`/imports/jobs/${currentJob.id}/cancel`, {
                                method: "POST"
                              });
                              setCurrentJob(updated);
                              setPageError(null);
                              const jobs = await loadJobs();
                              setJobsResponse(jobs);
                            } catch (cancelError) {
                              setActionError(cancelError instanceof Error ? cancelError.message : "Impossible d annuler le job");
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                        >
                          <XCircleIcon className="size-4" />
                          Annuler
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!hasImportsManage || !currentJob || !canPurgeJob(currentJob) || busyAction !== null}
                          onClick={() => {
                            if (!currentJob) {
                              return;
                            }
                            setPendingPurgeJob(currentJob);
                          }}
                        >
                          Purger les creations
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!hasImportsManage || !currentJob || !canDeleteJob(currentJob) || busyAction !== null}
                          onClick={() => {
                            if (!currentJob) {
                              return;
                            }
                            setPendingDeleteJob(currentJob);
                          }}
                        >
                          <Trash2Icon className="size-4" />
                          Supprimer le job
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        La suppression du job efface son historique et ses artefacts locaux. Si des creations metier de ce job
                        existent encore, le backend bloque l action tant qu une purge prealable reste necessaire.
                      </p>
                    </div>
                  </PageSection>

                  <PageSection
                    title="Profils de mapping"
                    description="Charge un profil existant ou sauvegarde le mapping courant."
                  >
                    <div className="space-y-4">
                      <Field label="Profil existant">
                        <Select
                          value={selectedProfileId}
                          onValueChange={(value) => void loadProfileDetail(value ?? "none")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choisir un profil" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun profil</SelectItem>
                            {profileOptions.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Nom du profil">
                        <Input
                          value={profileName}
                          onChange={(event) => setProfileName(event.target.value)}
                          placeholder="Import spatial Marseille"
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!canPersistProfile || busyAction !== null}
                          onClick={() => void saveProfile("create")}
                        >
                          <SaveIcon className="size-4" />
                          Sauvegarder comme nouveau
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canPersistProfile || !selectedProfile || busyAction !== null}
                          onClick={() => void saveProfile("update")}
                        >
                          <SaveIcon className="size-4" />
                          Mettre a jour le profil
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Le profil selectionne peut etre rejoue tel quel via `profileId`, ou surcharge par `overrideMappings` si tu ajustes le mapping inline.
                      </p>
                    </div>
                  </PageSection>

                  <PageSection
                    title="Historique des jobs"
                    description="Reouvrir un job existant, relire sa source et son dernier rapport."
                  >
                    <div className="space-y-4">
                      {jobsResponse ? (
                        <DataGrid
                          rows={jobsResponse.items}
                          columns={[
                            {
                              key: "targetDomain",
                              label: "Domaine",
                              render: (item) => <span className="font-medium text-foreground">{TARGET_DOMAIN_LABELS[item.targetDomain]}</span>
                            },
                            {
                              key: "status",
                              label: "Statut",
                              render: (item) => <StatusPill label={item.status} />
                            },
                            {
                              key: "file",
                              label: "Fichier",
                              render: (item) => <span className="text-sm text-muted-foreground">{item.originalFilename ?? "-"}</span>
                            },
                            {
                              key: "updatedAt",
                              label: "Maj",
                              render: (item) => <span className="text-sm text-muted-foreground">{item.updatedAt.slice(0, 16).replace("T", " ")}</span>
                            }
                          ]}
                          getRowId={(item) => item.id}
                          getMobileTitle={(item) => TARGET_DOMAIN_LABELS[item.targetDomain]}
                          getMobileDescription={(item) => item.originalFilename ?? "Sans fichier"}
                          getMobileMeta={(item) => (
                            <div className="space-y-2">
                              <StatusPill label={item.status} />
                              <p className="text-sm text-muted-foreground">{item.updatedAt.slice(0, 16).replace("T", " ")}</p>
                            </div>
                          )}
                          rowActions={[
                            {
                              label: "Ouvrir",
                              onClick: (item) => void openJob(item.id)
                            },
                            {
                              label: "Purger les creations",
                              isVisible: (item) => hasImportsManage && canPurgeJob(item),
                              isDisabled: () => busyAction !== null,
                              onClick: (item) => setPendingPurgeJob(item)
                            },
                            {
                              label: "Supprimer le job",
                              isVisible: (item) => hasImportsManage && canDeleteJob(item),
                              isDisabled: () => busyAction !== null,
                              onClick: (item) => setPendingDeleteJob(item)
                            }
                          ]}
                          onRowClick={(item) => void openJob(item.id)}
                          emptyTitle="Aucun job"
                          emptyDescription="Aucun job ne correspond aux filtres courants."
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Chargement de l historique...</p>
                      )}
                    </div>
                  </PageSection>
                </div>
              </div>
            ) : null}
          </div>
        }
        pagination={
          <PaginationBar
            page={jobsResponse?.page ?? jobsQuery.page}
            pageSize={jobsResponse?.pageSize ?? jobsQuery.pageSize}
            total={jobsResponse?.total ?? 0}
            onPageChange={(page) => setJobsQuery((current) => ({ ...current, page }))}
            onPageSizeChange={(pageSize) => setJobsQuery((current) => ({ ...current, pageSize, page: 1 }))}
          />
        }
      />
      <Dialog open={pendingPurgeJob !== null} onOpenChange={(open) => (!open ? setPendingPurgeJob(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purger les creations du job</DialogTitle>
            <DialogDescription>
              Cette action supprime uniquement les creations metier tracees par ce job. Les mises a jour appliquees par ce
              job ne seront pas annulees. La purge sera bloquee si des liens externes rendent la suppression incoherente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPurgeJob(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={!pendingPurgeJob || busyAction !== null}
              onClick={() => {
                if (!pendingPurgeJob) {
                  return;
                }
                void purgeCreatedData(pendingPurgeJob);
              }}
            >
              Purger les creations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingDeleteJob !== null} onOpenChange={(open) => (!open ? setPendingDeleteJob(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le job</DialogTitle>
            <DialogDescription>
              Cette action supprime definitivement l historique du job et ses artefacts locaux. Si des creations metier de ce
              job existent encore, la suppression sera refusee tant qu elles n auront pas ete purgees.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteJob(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={!pendingDeleteJob || busyAction !== null}
              onClick={() => {
                if (!pendingDeleteJob) {
                  return;
                }
                void deleteJob(pendingDeleteJob);
              }}
            >
              Supprimer le job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={selectedIfcEquipment !== null} onOpenChange={(open) => (!open ? setSelectedIfcEquipment(null) : undefined)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail equipement IFC4</DialogTitle>
            <DialogDescription>
              Consultation des donnees extraites avant generation du job equipments.
            </DialogDescription>
          </DialogHeader>
          {selectedIfcEquipment ? (
            <div className="max-h-[70vh] space-y-5 overflow-auto pr-2">
              <div className="grid gap-3 md:grid-cols-2">
                <ReadOnlyField label="Code interne" value={selectedIfcEquipment.internalCode} />
                <ReadOnlyField label="Num piece" value={selectedIfcEquipment.numPiece ?? "-"} />
                <ReadOnlyField label="Reference externe" value={selectedIfcEquipment.externalRef ?? "-"} />
                <ReadOnlyField label="Libelle" value={selectedIfcEquipment.label ?? "-"} />
                <ReadOnlyField label="Categorie" value={compactReferenceValue(selectedIfcEquipment.classification.category)} />
                <ReadOnlyField label="Famille" value={compactReferenceValue(selectedIfcEquipment.classification.family)} />
                <ReadOnlyField label="Sous-famille" value={compactReferenceValue(selectedIfcEquipment.classification.subfamily)} />
                <ReadOnlyField label="Type" value={compactReferenceValue(selectedIfcEquipment.classification.type)} />
                <ReadOnlyField label="Marque" value={compactReferenceValue(selectedIfcEquipment.classification.brand)} />
                <ReadOnlyField label="Modele" value={compactReferenceValue(selectedIfcEquipment.classification.model)} />
                <ReadOnlyField label="Statut" value={compactReferenceValue(selectedIfcEquipment.classification.status)} />
                <ReadOnlyField label="Proprietaire" value={compactReferenceValue(selectedIfcEquipment.classification.owner)} />
                <ReadOnlyField label="Localisation cible" value={selectedIfcEquipment.currentSpatialPath ?? "-"} />
                <ReadOnlyField label="Noeud spatial" value={selectedIfcEquipment.spatialNode?.label ?? "-"} />
                <ReadOnlyField label="Reference spatiale externe" value={selectedIfcEquipment.currentSpatialExternalRef ?? "-"} />
                <ReadOnlyField label="Classe IFC" value={selectedIfcEquipment.sourceClass} />
                <ReadOnlyField label="GlobalId IFC" value={selectedIfcEquipment.sourceGlobalId ?? "-"} />
                <ReadOnlyField label="Geometrie" value={geometryBadgeLabel(selectedIfcEquipment.geometry?.geometryStatus)} />
                <ReadOnlyField label="Dimensions XYZ" value={geometrySizeLabel(selectedIfcEquipment.geometry)} />
              </div>
              {selectedIfcEquipment.anomalyReasons.length > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                  {selectedIfcEquipment.anomalyReasons.join(" ")}
                </div>
              ) : null}
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground">Proprietes IFC conservees</p>
                {Object.keys(selectedIfcEquipment.properties).length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Aucune propriete source detectee.</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {Object.entries(selectedIfcEquipment.properties).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{key}</p>
                        <p className="mt-1 break-words text-sm text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIfcEquipment(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default function ImportsPage() {
  return (
    <Suspense fallback={null}>
      <ImportsPageContent />
    </Suspense>
  );
}
