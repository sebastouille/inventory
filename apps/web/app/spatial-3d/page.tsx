"use client";

import type {
  Bim3dAgeBucket,
  Bim3dMapBuildSummary,
  Bim3dMapSummary,
  Bim3dScene,
  SpatialNodeType
} from "@inventory/shared";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { BoxIcon, CuboidIcon, Layers3Icon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BimSceneViewer, type Bim3dSelection } from "@/components/bim-3d/bim-scene-viewer";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, apiUpload, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

const AGE_BUCKET_LABELS: Record<Bim3dAgeBucket | "all", string> = {
  all: "Toutes les anciennetes",
  FRESH: "0 a 1 mois",
  RECENT: "1 a 3 mois",
  WARNING: "3 a 6 mois",
  STALE: "6 a 12 mois",
  CRITICAL: "Plus de 12 mois",
  UNKNOWN: "Non inventorie"
};

const NODE_TYPE_LABELS: Record<SpatialNodeType | "all", string> = {
  all: "Tous les noeuds",
  SITE: "Sites",
  BUILDING: "Batiments",
  FLOOR: "Etages",
  ZONE: "Zones",
  ROOM: "Pieces",
  LOCATION: "Emplacements"
};

function isReadyMap(map: Bim3dMapSummary) {
  return map.status === "READY" && Boolean(map.sceneFileRef);
}

function statusForMap(map: Bim3dMapSummary) {
  if (map.status === "READY") return "active";
  if (map.status === "FAILED") return "destructive";
  if (map.status === "ARCHIVED") return "inactive";
  return "warning";
}

function geometryModeLabel(scene: Bim3dScene | null) {
  const mode = scene?.metadata.geometrySource ?? scene?.limits.mode;
  if (mode === "ifcopenshell-bounding-boxes" || mode === "ifc-bounding-boxes") {
    return "Coordonnees IFC";
  }
  if (mode === "ifc-persisted-geometry") {
    return "Geometrie IFC importee";
  }
  if (mode === "mixed-ifc-fallback") {
    return "Mode mixte";
  }
  return "Fallback spatial";
}

function selectionTitle(selection: Bim3dSelection) {
  if (!selection) {
    return "Aucune selection";
  }
  if (selection.kind === "node") {
    return `${selection.item.code} - ${selection.item.label}`;
  }
  return `${selection.item.internalCode} - ${selection.item.typeLabel}`;
}

export default function Spatial3dPage() {
  const token = useStoredToken();
  const ifcInputRef = useRef<HTMLInputElement | null>(null);
  const [maps, setMaps] = useState<Bim3dMapSummary[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>("");
  const [scene, setScene] = useState<Bim3dScene | null>(null);
  const [history, setHistory] = useState<Bim3dMapBuildSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [floorGuidesEnabled, setFloorGuidesEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [nodeType, setNodeType] = useState<SpatialNodeType | "all">("all");
  const [ageBucket, setAgeBucket] = useState<Bim3dAgeBucket | "all">("all");
  const [selected, setSelected] = useState<Bim3dSelection>(null);

  const selectedMap = maps.find((map) => map.id === selectedMapId) ?? null;

  const loadMaps = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await apiFetch<Bim3dMapSummary[]>("/bim-3d/maps");
      setMaps(response);
      const current = response.find((map) => map.id === selectedMapId);
      const nextMap = current && isReadyMap(current) ? current : response.find(isReadyMap);
      setSelectedMapId(nextMap?.id ?? "");
      setError(null);
    } catch (loadError) {
      if (isUnauthorizedApiError(loadError)) {
        setError(null);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les cartes 3D");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMapId, token]);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    if (!token || !selectedMapId) {
      setScene(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    const loadScene = async () => {
      setIsLoading(true);
      try {
        const [sceneResponse, historyResponse] = await Promise.all([
          apiFetch<Bim3dScene>(`/bim-3d/maps/${selectedMapId}/scene`),
          apiFetch<Bim3dMapBuildSummary[]>(`/bim-3d/maps/${selectedMapId}/history`)
        ]);
        if (cancelled) return;
        setScene(sceneResponse);
        setHistory(historyResponse);
        setSelected(null);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          return;
        }
        setScene(null);
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la scene 3D");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void loadScene();
    return () => {
      cancelled = true;
    };
  }, [selectedMapId, token]);

  const buildMap = async () => {
    setIsBuilding(true);
    try {
      const map = await apiFetch<Bim3dMapSummary>("/bim-3d/maps/build", {
        method: "POST",
        body: JSON.stringify({
          name: `Carte 3D ${new Date().toLocaleDateString("fr-FR")}`,
          mode: "simplified",
          includeEquipments: true
        })
      });
      await loadMaps();
      setSelectedMapId(map.id);
      setError(null);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Impossible de generer la carte 3D depuis la geometrie IFC importee");
    } finally {
      setIsBuilding(false);
    }
  };

  const buildIfcMap = async (file: File) => {
    setIsBuilding(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("name", `Carte IFC ${file.name.replace(/\.ifc$/i, "")}`);
      formData.set("includeEquipments", "true");
      formData.set("includeFloorGuides", "true");
      const map = await apiUpload<Bim3dMapSummary>("/bim-3d/maps/build-ifc", formData);
      await loadMaps();
      setSelectedMapId(map.id);
      setError(map.errorMessage ? `Carte generee en fallback: ${map.errorMessage}` : null);
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Impossible de generer la carte 3D depuis IFC");
    } finally {
      setIsBuilding(false);
      if (ifcInputRef.current) {
        ifcInputRef.current.value = "";
      }
    }
  };

  const filtered = useMemo(() => {
    if (!scene) {
      return {
        visibleNodeIds: new Set<string>(),
        visibleEquipmentIds: new Set<string>()
      };
    }

    const search = query.trim().toLowerCase();
    const visibleNodeIds = new Set(
      scene.nodes
        .filter((node) => nodeType === "all" || node.type === nodeType)
        .filter((node) => {
          if (!search) return true;
          return [node.code, node.label, node.path].some((value) => value.toLowerCase().includes(search));
        })
        .map((node) => node.id)
    );

    const visibleEquipmentIds = new Set(
      scene.equipments
        .filter((equipment) => ageBucket === "all" || equipment.ageBucket === ageBucket)
        .filter((equipment) => {
          if (equipment.spatialNodeId && !visibleNodeIds.has(equipment.spatialNodeId) && nodeType !== "all") {
            return false;
          }
          if (!search) return true;
          return [
            equipment.internalCode,
            equipment.label,
            equipment.spatialPath,
            equipment.statusLabel,
            equipment.familyLabel,
            equipment.typeLabel
          ].some((value) => value?.toLowerCase().includes(search));
        })
        .map((equipment) => equipment.id)
    );

    for (const equipment of scene.equipments) {
      if (visibleEquipmentIds.has(equipment.id) && equipment.spatialNodeId) {
        visibleNodeIds.add(equipment.spatialNodeId);
      }
    }

    return { visibleNodeIds, visibleEquipmentIds };
  }, [ageBucket, nodeType, query, scene]);

  if (!token) {
    return <WebAuthScreen />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageSection
          title="Carte 3D"
          description="Visualisation simplifiee des noeuds spatiaux, des equipements et de l anciennete d inventaire."
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => void loadMaps()} disabled={isLoading}>
                <RefreshCwIcon className="size-4" />
                Rafraichir
              </Button>
              <Button onClick={() => void buildMap()} disabled={isBuilding}>
                <SparklesIcon className="size-4" />
                {isBuilding ? "Generation..." : "Generer depuis geometrie importee"}
              </Button>
              <input
                ref={ifcInputRef}
                type="file"
                accept=".ifc"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void buildIfcMap(file);
                  }
                }}
              />
              <Button variant="outline" onClick={() => ifcInputRef.current?.click()} disabled={isBuilding}>
                <CuboidIcon className="size-4" />
                Generer depuis IFC
              </Button>
            </div>
          }
        >
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Carte">
                <Select value={selectedMapId || "none"} onValueChange={(value) => setSelectedMapId(value === "none" ? "" : value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner une carte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune carte</SelectItem>
                    {maps.map((map) => (
                      <SelectItem key={map.id} value={map.id}>
                        {map.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Recherche">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, libelle, noeud" />
              </Field>
              <Field label="Type de noeud">
                <Select value={nodeType} onValueChange={(value) => setNodeType((value as SpatialNodeType | "all") ?? "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NODE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Anciennete">
                <Select value={ageBucket} onValueChange={(value) => setAgeBucket((value as Bim3dAgeBucket | "all") ?? "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Anciennete" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AGE_BUCKET_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {selectedMap ? <StatusBadge status={statusForMap(selectedMap)} label={selectedMap.status} /> : null}
              <Button
                variant={heatmapEnabled ? "default" : "outline"}
                onClick={() => setHeatmapEnabled((current) => !current)}
              >
                <Layers3Icon className="size-4" />
                Heatmap
              </Button>
              <Button
                variant={floorGuidesEnabled ? "default" : "outline"}
                onClick={() => setFloorGuidesEnabled((current) => !current)}
              >
                <CuboidIcon className="size-4" />
                Etages
              </Button>
            </div>
          </div>
        </PageSection>

        {scene ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <BimSceneViewer
              scene={scene}
              heatmapEnabled={heatmapEnabled}
              visibleNodeIds={filtered.visibleNodeIds}
              visibleEquipmentIds={filtered.visibleEquipmentIds}
              selected={selected}
              onSelect={setSelected}
              showFloorGuides={floorGuidesEnabled}
            />
            <div className="space-y-5">
              <PageSection title="Selection" description="Element actuellement mis en surbrillance.">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-border/70 bg-accent/10 p-3 text-accent">
                      {selected?.kind === "equipment" ? <BoxIcon className="size-5" /> : <CuboidIcon className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-lg font-semibold">{selectionTitle(selected)}</p>
                      <p className="text-sm text-muted-foreground">
                        {selected?.kind === "node"
                          ? selected.item.path
                          : selected?.kind === "equipment"
                            ? selected.item.spatialPath ?? "Sans noeud spatial"
                            : "Cliquer sur un noeud ou un equipement dans la carte."}
                      </p>
                    </div>
                  </div>
                  {selected?.kind === "equipment" ? (
                    <div className="grid gap-2 text-sm">
                      <p><span className="text-muted-foreground">Statut:</span> {selected.item.statusLabel}</p>
                      <p><span className="text-muted-foreground">Famille:</span> {selected.item.familyLabel}</p>
                      <p><span className="text-muted-foreground">Anciennete:</span> {AGE_BUCKET_LABELS[selected.item.ageBucket]}</p>
                      <p><span className="text-muted-foreground">Dernier inventaire:</span> {selected.item.lastInventoryAt ?? "Non renseigne"}</p>
                      <p><span className="text-muted-foreground">Geometrie:</span> {selected.item.geometrySource ?? "spatial-fallback"}</p>
                    </div>
                  ) : null}
                  {selected?.kind === "node" ? (
                    <div className="grid gap-2 text-sm">
                      <p><span className="text-muted-foreground">Type:</span> {NODE_TYPE_LABELS[selected.item.type]}</p>
                      <p><span className="text-muted-foreground">Equipements:</span> {selected.item.equipmentsCount}</p>
                      <p><span className="text-muted-foreground">Geometrie:</span> {selected.item.geometrySource ?? "spatial-fallback"}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selected.item.ageSummary).map(([key, value]) => (
                          <Badge key={key} variant="outline">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </PageSection>
              <PageSection title="Synthese scene" description="Limites de rendu V1 et dernier build.">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="text-muted-foreground">Noeuds visibles</p>
                    <p className="font-heading text-2xl font-semibold">{filtered.visibleNodeIds.size}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="text-muted-foreground">Equipements visibles</p>
                    <p className="font-heading text-2xl font-semibold">{filtered.visibleEquipmentIds.size}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="text-muted-foreground">Mode</p>
                    <p className="font-medium">{geometryModeLabel(scene)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="text-muted-foreground">Generee le</p>
                    <p className="font-medium">{new Date(scene.metadata.generatedAt).toLocaleString("fr-FR")}</p>
                  </div>
                </div>
                {history[0] ? (
                  <p className="text-sm text-muted-foreground">
                    Dernier build: {history[0].status} en {history[0].durationMs ?? 0} ms.
                  </p>
                ) : null}
              </PageSection>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Aucune carte 3D disponible"
            description="Generer une scene simplifiee depuis les noeuds spatiaux et les equipements existants."
            icon={<CuboidIcon className="size-5" />}
            actionLabel={isBuilding ? "Generation..." : "Generer la carte 3D"}
            onAction={() => void buildMap()}
          />
        )}
      </div>
    </AppShell>
  );
}
