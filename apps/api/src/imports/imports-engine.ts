import * as XLSX from "xlsx";
import {
  IMPORT_REPORT_MODES,
  type ImportJobReport,
  type ImportJobSummaryResponse,
  type ImportMappingInput,
  type ImportReportMode,
  type ImportRowPreview,
  type ImportRowReport,
  type ImportRowStatus,
  type ImportSourceKind,
  type ImportSourceSnapshot,
  type ImportTargetDomain,
  type ImportTargetFieldDefinition,
  type ImportTransformType
} from "@inventory/shared";

type RawRow = ImportRowPreview;

const TARGET_FIELD_CATALOG: Record<ImportTargetDomain, ImportTargetFieldDefinition[]> = {
  "ifc4-analysis": [],
  "spatial-nodes": [
    { key: "type", label: "Type", required: true, description: "Type de noeud spatial." },
    { key: "code", label: "Code", required: true, description: "Code metier du noeud." },
    { key: "label", label: "Libelle", required: true, description: "Libelle du noeud." },
    { key: "description", label: "Description", required: false, description: "Description libre." },
    { key: "path", label: "Chemin", required: false, description: "Chemin logique complet du noeud." },
    { key: "parentPath", label: "Chemin parent", required: false, description: "Chemin logique du parent." },
    { key: "externalRef", label: "Reference externe", required: false, description: "Reference source du noeud." },
    { key: "sourceClass", label: "Classe source", required: false, description: "Classe source technique comme IfcSpace." },
    { key: "sourceMetadata", label: "Metadonnees source", required: false, description: "Bloc JSON source optionnel." },
    { key: "geometrySource", label: "Source geometrie", required: false, description: "Moteur ou origine de la geometrie." },
    { key: "geometryMetadata", label: "Metadonnees geometrie", required: false, description: "Bloc JSON geometrie IFC." },
    { key: "worldCenterX", label: "Centre monde X", required: false, description: "Coordonnee monde X en metres." },
    { key: "worldCenterY", label: "Centre monde Y", required: false, description: "Coordonnee monde Y en metres." },
    { key: "worldCenterZ", label: "Centre monde Z", required: false, description: "Coordonnee monde Z en metres." },
    { key: "worldSizeX", label: "Taille monde X", required: false, description: "Dimension maximale X en metres." },
    { key: "worldSizeY", label: "Taille monde Y", required: false, description: "Dimension maximale Y en metres." },
    { key: "worldSizeZ", label: "Taille monde Z", required: false, description: "Dimension maximale Z en metres." },
    { key: "isActive", label: "Actif", required: false, description: "Etat logique du noeud." }
  ],
  equipments: [
    { key: "internalCode", label: "Code interne", required: true, description: "Cle terrain unique." },
    { key: "numPiece", label: "Numero piece", required: false, description: "Numero ou code de piece associe." },
    { key: "externalRef", label: "Reference externe", required: false, description: "Reference source de l equipement." },
    { key: "serialNumber", label: "Numero de serie", required: false, description: "Numero constructeur." },
    { key: "equipmentTypeCode", label: "Code type", required: true, description: "Type d equipement." },
    { key: "equipmentModelCode", label: "Code modele", required: false, description: "Modele d equipement." },
    { key: "equipmentStatusCode", label: "Code statut", required: true, description: "Statut de l equipement." },
    { key: "ownerEntityCode", label: "Code proprietaire", required: true, description: "Proprietaire metier." },
    {
      key: "currentSpatialPath",
      label: "Chemin spatial",
      required: false,
      description: "Chemin complet du noeud spatial courant."
    },
    { key: "currentSpatialCode", label: "Code spatial", required: false, description: "Noeud spatial courant." },
    {
      key: "currentSpatialExternalRef",
      label: "Reference spatiale externe",
      required: false,
      description: "Reference externe du noeud spatial."
    },
    {
      key: "technicalCharacteristics",
      label: "Caracteristiques techniques",
      required: false,
      description: "Bloc libre de caracteristiques."
    },
    { key: "geometrySource", label: "Source geometrie", required: false, description: "Moteur ou origine de la geometrie." },
    { key: "geometryMetadata", label: "Metadonnees geometrie", required: false, description: "Bloc JSON geometrie IFC." },
    { key: "worldCenterX", label: "Centre monde X", required: false, description: "Coordonnee monde X en metres." },
    { key: "worldCenterY", label: "Centre monde Y", required: false, description: "Coordonnee monde Y en metres." },
    { key: "worldCenterZ", label: "Centre monde Z", required: false, description: "Coordonnee monde Z en metres." },
    { key: "worldSizeX", label: "Taille monde X", required: false, description: "Dimension maximale X en metres." },
    { key: "worldSizeY", label: "Taille monde Y", required: false, description: "Dimension maximale Y en metres." },
    { key: "worldSizeZ", label: "Taille monde Z", required: false, description: "Dimension maximale Z en metres." },
    { key: "notes", label: "Notes", required: false, description: "Notes metier." },
    { key: "receivedAt", label: "Date reception", required: false, description: "Date de reception." },
    { key: "commissionedAt", label: "Date mise en service", required: false, description: "Date de mise en service." },
    {
      key: "immobilizationCode",
      label: "Code immobilisation",
      required: false,
      description: "Code comptable associe."
    }
  ],
  immobilizations: [
    { key: "code", label: "Code immobilisation", required: true, description: "Cle comptable." },
    { key: "label", label: "Libelle", required: true, description: "Designation de l immobilisation." },
    { key: "description", label: "Description", required: false, description: "Description libre." },
    { key: "status", label: "Statut", required: false, description: "Statut comptable." },
    { key: "costCenter", label: "Centre de cout", required: false, description: "Centre de cout." },
    { key: "purchaseValue", label: "Valeur achat", required: false, description: "Montant d achat." },
    { key: "purchaseDate", label: "Date achat", required: false, description: "Date d achat." },
    {
      key: "serviceStartAt",
      label: "Date mise en service",
      required: false,
      description: "Date de mise en service."
    },
    { key: "sourceSystem", label: "Systeme source", required: false, description: "Systeme source type SINERGI ou SAP." },
    { key: "externalRef", label: "Reference externe", required: false, description: "Reference source." }
  ]
};

function ensureUniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Column_${index + 1}`;
    const current = seen.get(base) ?? 0;
    seen.set(base, current + 1);
    return current === 0 ? base : `${base}_${current + 1}`;
  });
}

function cellToString(value: unknown) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "oui", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "non", "n"].includes(normalized)) {
    return false;
  }
  return null;
}

function transformValue(
  rawValue: string | null,
  transformType: ImportTransformType,
  transformConfig?: Record<string, unknown> | null
) {
  if (transformType === "CONSTANT") {
    return {
      value: transformConfig && "value" in transformConfig ? cellToString(transformConfig.value) : null,
      messages: [] as string[]
    };
  }

  if (rawValue == null) {
    return {
      value: null,
      messages: [] as string[]
    };
  }

  switch (transformType) {
    case "IDENTITY":
    case "LOOKUP_BY_CODE":
    case "LOOKUP_BY_EXTERNAL_REF":
      return { value: rawValue, messages: [] as string[] };
    case "TRIM":
      return { value: rawValue.trim(), messages: [] as string[] };
    case "UPPERCASE":
      return { value: rawValue.toUpperCase(), messages: [] as string[] };
    case "LOWERCASE":
      return { value: rawValue.toLowerCase(), messages: [] as string[] };
    case "NUMBER": {
      const parsed = Number(rawValue.replace(",", "."));
      return Number.isFinite(parsed)
        ? { value: parsed, messages: [] as string[] }
        : { value: rawValue, messages: ["Valeur numerique invalide"] };
    }
    case "DATE": {
      const date = new Date(rawValue);
      return Number.isNaN(date.getTime())
        ? { value: rawValue, messages: ["Valeur de date invalide"] }
        : { value: date.toISOString(), messages: [] as string[] };
    }
    case "BOOLEAN": {
      const parsed = parseBoolean(rawValue);
      return parsed == null
        ? { value: rawValue, messages: ["Valeur booleenne invalide"] }
        : { value: parsed, messages: [] as string[] };
    }
  }
}

function buildResolvedTargetKey(
  targetDomain: ImportTargetDomain,
  normalizedValues: Record<string, string | number | boolean | null>
) {
  if (targetDomain === "spatial-nodes") {
    if (typeof normalizedValues.path === "string") {
      return normalizedValues.path;
    }
    return typeof normalizedValues.code === "string" ? normalizedValues.code : null;
  }
  if (targetDomain === "equipments") {
    return typeof normalizedValues.internalCode === "string" ? normalizedValues.internalCode : null;
  }
  return typeof normalizedValues.code === "string" ? normalizedValues.code : null;
}

export function getTargetFieldCatalog(targetDomain: ImportTargetDomain) {
  return TARGET_FIELD_CATALOG[targetDomain];
}

export function validateMappingSet(targetDomain: ImportTargetDomain, mappings: ImportMappingInput[]) {
  const catalog = getTargetFieldCatalog(targetDomain);
  const allowedFields = new Set(catalog.map((field) => field.key));
  const requiredFields = catalog.filter((field) => field.required).map((field) => field.key);
  const errors: string[] = [];
  const seenTargetFields = new Set<string>();

  if (mappings.length === 0) {
    errors.push("Au moins un mapping est requis");
  }

  for (const mapping of mappings) {
    if (!allowedFields.has(mapping.targetField)) {
      errors.push(`Champ cible inconnu: ${mapping.targetField}`);
    }
    if (seenTargetFields.has(mapping.targetField)) {
      errors.push(`Champ cible duplique: ${mapping.targetField}`);
    }
    seenTargetFields.add(mapping.targetField);
  }

  for (const requiredField of requiredFields) {
    if (!seenTargetFields.has(requiredField)) {
      errors.push(`Champ cible obligatoire non mappe: ${requiredField}`);
    }
  }

  return errors;
}

export function normalizeImportRows(input: {
  targetDomain: ImportTargetDomain;
  rawRows: RawRow[];
  mappings: ImportMappingInput[];
}) {
  const catalog = getTargetFieldCatalog(input.targetDomain);
  const requiredFields = new Set(catalog.filter((field) => field.required).map((field) => field.key));

  return input.rawRows.map((row) => {
    const normalizedValues: Record<string, string | number | boolean | null> = {};
    const messages: string[] = [];

    for (const mapping of input.mappings) {
      const rawValue = row.values[mapping.sourceColumn] ?? null;
      const transformed = transformValue(rawValue, mapping.transformType, mapping.transformConfig ?? null);
      normalizedValues[mapping.targetField] = transformed.value;
      messages.push(...transformed.messages.map((message) => `${mapping.targetField}: ${message}`));

      const isRequired = mapping.isRequired ?? requiredFields.has(mapping.targetField);
      if (isRequired && (transformed.value == null || transformed.value === "")) {
        messages.push(`${mapping.targetField}: valeur obligatoire manquante`);
      }
    }

    const requiredMissing = [...requiredFields].filter((field) => normalizedValues[field] == null || normalizedValues[field] === "");
    for (const missing of requiredMissing) {
      if (!messages.includes(`${missing}: valeur obligatoire manquante`)) {
        messages.push(`${missing}: valeur obligatoire manquante`);
      }
    }

    return {
      rowIndex: row.rowIndex,
      normalizedValues,
      messages,
      resolvedTargetKey: buildResolvedTargetKey(input.targetDomain, normalizedValues)
    };
  });
}

export function parseImportBuffer(
  buffer: Buffer,
  sourceKind: ImportSourceKind,
  input: {
    sheetName?: string | null;
    headerRowIndex?: number | null;
  }
) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    dense: true,
    codepage: sourceKind === "CSV" ? 65001 : undefined
  });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error("Le fichier importe ne contient aucune feuille exploitable");
  }

  const selectedSheetName = input.sheetName && sheetNames.includes(input.sheetName) ? input.sheetName : sheetNames[0];
  const selectedSheet = workbook.Sheets[selectedSheetName];
  const headerRowIndex = Math.max(1, input.headerRowIndex ?? 1);
  const rowsAsMatrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(selectedSheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: null
  });
  const headerRow = rowsAsMatrix[headerRowIndex - 1] ?? [];
  const headers = ensureUniqueHeaders(headerRow.map((value) => cellToString(value) ?? ""));
  const rawRows: RawRow[] = rowsAsMatrix.slice(headerRowIndex).map((row, offset) => {
    const values: Record<string, string | null> = {};
    headers.forEach((header, columnIndex) => {
      values[header] = cellToString(row[columnIndex]);
    });
    return {
      rowIndex: headerRowIndex + offset + 1,
      values
    };
  });

  const sourceSnapshot: ImportSourceSnapshot = {
    sheetNames,
    selectedSheetName,
    headerRowIndex,
    headers,
    rowCount: rawRows.length,
    previewRows: rawRows.slice(0, 20),
    rawRowsRef: ""
  };

  return {
    sourceSnapshot,
    rawRows
  };
}

export function buildImportReport(input: {
  targetDomain: ImportTargetDomain;
  mode: ImportReportMode;
  headers: string[];
  rawRows: RawRow[];
  mappings: ImportMappingInput[];
}) {
  if (!IMPORT_REPORT_MODES.includes(input.mode)) {
    throw new Error("Mode de rapport non supporte");
  }

  const rows: ImportRowReport[] = normalizeImportRows({
    targetDomain: input.targetDomain,
    rawRows: input.rawRows,
    mappings: input.mappings
  }).map((row) => {
    let status: ImportRowStatus;
    if (row.messages.some((message) => message.includes("obligatoire") || message.includes("invalide"))) {
      status = "REJECTED";
    } else if (input.mode === "EXECUTE_NOOP") {
      status = "SIMULATED";
    } else if (input.mode === "EXECUTE") {
      status = "VALID";
    } else if (row.messages.length > 0) {
      status = "WARNING";
    } else {
      status = "VALID";
    }

    return {
      rowIndex: row.rowIndex,
      status,
      resolvedTargetKey: row.resolvedTargetKey,
      normalizedValues: row.normalizedValues,
      messages: row.messages
    };
  });

  const summary: ImportJobSummaryResponse = {
    rowsRead: rows.length,
    rowsValid: rows.filter((row) => row.status !== "REJECTED").length,
    rowsRejected: rows.filter((row) => row.status === "REJECTED").length,
    rowsWithWarnings: rows.filter((row) => row.status === "WARNING").length,
    simulatedWrites: rows.filter((row) => row.status === "SIMULATED").length,
    appliedWrites: 0,
    executionMode: input.mode,
    targetDomain: input.targetDomain
  };

  const report: ImportJobReport = {
    mode: input.mode,
    targetDomain: input.targetDomain,
    headers: input.headers,
    mappings: input.mappings,
    summary,
    rows
  };

  return report;
}
