"use client";

import type {
  EquipmentLabelPreviewItem,
  LabelExportFormat,
  LabelExportPreviewResponse,
  PaginatedResponse,
  SpatialNodeLabelPreviewItem,
  SpatialNodeListItem
} from "@inventory/shared";
import {
  Button,
  Field,
  FilterBar,
  FormSection,
  ListPage,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@inventory/ui";
import { DownloadIcon, EyeIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiDownloadPost, apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

type Mode = "equipments" | "spatial-nodes";

export default function LabelsPage() {
  const token = useStoredToken();
  const [nodes, setNodes] = useState<SpatialNodeListItem[]>([]);
  const [mode, setMode] = useState<Mode>("equipments");
  const [selectedNodeId, setSelectedNodeId] = useState("all");
  const [includeChildren, setIncludeChildren] = useState("true");
  const [format, setFormat] = useState<LabelExportFormat>("xlsx");
  const [q, setQ] = useState("");
  const [equipmentPreview, setEquipmentPreview] =
    useState<LabelExportPreviewResponse<EquipmentLabelPreviewItem> | null>(null);
  const [spatialPreview, setSpatialPreview] =
    useState<LabelExportPreviewResponse<SpatialNodeLabelPreviewItem> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNodes = useCallback(async () => {
    const response = await apiFetch<PaginatedResponse<SpatialNodeListItem>>(
      "/spatial/nodes?page=1&pageSize=200&sort=path&direction=asc&isActive=true"
    );
    setNodes(response.items);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadNodes().catch((loadError) => {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les noeuds spatiaux");
      }
    });
  }, [loadNodes, token]);

  if (!token) {
    return <WebAuthScreen />;
  }

  const selectedSpatialNodeIds = selectedNodeId === "all" ? [] : [selectedNodeId];
  const basePayload = {
    selectedSpatialNodeIds,
    includeChildren: includeChildren === "true",
    format
  };

  const preview = async () => {
    try {
      if (mode === "equipments") {
        const response = await apiFetch<LabelExportPreviewResponse<EquipmentLabelPreviewItem>>(
          "/label-exports/equipments/preview",
          {
            method: "POST",
            body: JSON.stringify({
              ...basePayload,
              q: q || undefined
            })
          }
        );
        setEquipmentPreview(response);
        setSpatialPreview(null);
      } else {
        const response = await apiFetch<LabelExportPreviewResponse<SpatialNodeLabelPreviewItem>>(
          "/label-exports/spatial-nodes/preview",
          {
            method: "POST",
            body: JSON.stringify(basePayload)
          }
        );
        setSpatialPreview(response);
        setEquipmentPreview(null);
      }
      setError(null);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview etiquettes impossible");
    }
  };

  const download = async () => {
    try {
      const path = mode === "equipments" ? "/label-exports/equipments/export" : "/label-exports/spatial-nodes/export";
      await apiDownloadPost(
        path,
        mode === "equipments"
          ? {
              ...basePayload,
              q: q || undefined
            }
          : basePayload,
        mode === "equipments" ? "etiquettes-equipements.xlsx" : "etiquettes-noeuds.xlsx"
      );
      setError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Export etiquettes impossible");
    }
  };

  return (
    <AppShell>
      <ListPage
        eyebrow="Etiquettes"
        title="Etiquettes terrain"
        description="Generation stateless des etiquettes Code 128 a partir du code interne equipement ou du noeud spatial."
        filters={
          <FilterBar
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="Filtrer les equipements par code, type, localisation ou immobilisation"
            filters={
              <>
                <Select value={mode} onValueChange={(value) => setMode((value as Mode) ?? "equipments")}>
                  <SelectTrigger className="min-w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipments">Equipements</SelectItem>
                    <SelectItem value="spatial-nodes">Noeuds spatiaux</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedNodeId} onValueChange={(value) => setSelectedNodeId(value ?? "all")}>
                  <SelectTrigger className="min-w-72">
                    <SelectValue placeholder="Perimetre spatial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute l organisation</SelectItem>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.label} - {node.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={includeChildren} onValueChange={(value) => setIncludeChildren(value ?? "true")}>
                  <SelectTrigger className="min-w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Inclure enfants</SelectItem>
                    <SelectItem value="false">Noeud seul</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={format} onValueChange={(value) => setFormat((value as LabelExportFormat) ?? "xlsx")}>
                  <SelectTrigger className="min-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="ods">ODS</SelectItem>
                    <SelectItem value="pdf-a4">PDF A4</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <>
                <Button variant="outline" onClick={() => void loadNodes()}>
                  <RefreshCwIcon className="size-4" />
                  Referentiel
                </Button>
                <Button variant="outline" onClick={() => void preview()}>
                  <EyeIcon className="size-4" />
                  Previsualiser
                </Button>
                <Button onClick={() => void download()}>
                  <DownloadIcon className="size-4" />
                  Telecharger
                </Button>
              </>
            }
          />
        }
        grid={
          <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
            <FormSection
              title="Regles V1"
              description="Aucun historique n est cree. Le fichier est genere puis telecharge immediatement."
            >
              <Field label="Payload equipement">
                <div className="rounded-xl border border-border/70 px-3 py-2 font-mono text-sm">EQ:&lt;internalCode&gt;</div>
              </Field>
              <Field label="Payload noeud">
                <div className="rounded-xl border border-border/70 px-3 py-2 font-mono text-sm">NODE:&lt;spatialNodeId&gt;</div>
              </Field>
              <Field label="Code barres">
                <div className="rounded-xl border border-border/70 px-3 py-2 text-sm">Code 128 en priorite. QR code hors V1.</div>
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </FormSection>

            <PageSection
              title={mode === "equipments" ? "Preview equipements" : "Preview noeuds spatiaux"}
              description="Controle le contenu avant generation du fichier."
            >
              {mode === "equipments" ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{equipmentPreview?.total ?? 0} equipement(s).</p>
                  {(equipmentPreview?.items ?? []).slice(0, 50).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{item.internalCode}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.barcodePayload}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.family} - {item.type ?? "-"} - {item.currentSpatialPath ?? "sans localisation"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{spatialPreview?.total ?? 0} noeud(s).</p>
                  {(spatialPreview?.items ?? []).slice(0, 50).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {item.nodeType} - {item.nodeLabel}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{item.barcodePayload}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{item.spatialPath}</span>
                        {item.nodeType === "ROOM" && item.roomNumber ? (
                          <span className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-xs text-foreground">
                            {item.roomNumber}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PageSection>
          </div>
        }
        pagination={null}
      />
    </AppShell>
  );
}
