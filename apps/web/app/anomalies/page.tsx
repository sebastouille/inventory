"use client";

import type {
  CreateInventoryCorrectionInput,
  EquipmentReferenceItem,
  ImmobilizationSummary,
  InventoryAnomalyDetail,
  InventoryAnomalySummary,
  InventoryCorrectionType,
  PaginatedResponse,
  SpatialNodeListItem
} from "@inventory/shared";
import {
  Button,
  DataGrid,
  Field,
  FilterBar,
  FormSection,
  ListPage,
  PageSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea
} from "@inventory/ui";
import { RefreshCwIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function AnomaliesPage() {
  const token = useStoredToken();
  const [anomalies, setAnomalies] = useState<PaginatedResponse<InventoryAnomalySummary> | null>(null);
  const [selected, setSelected] = useState<InventoryAnomalyDetail | null>(null);
  const [nodes, setNodes] = useState<SpatialNodeListItem[]>([]);
  const [statuses, setStatuses] = useState<EquipmentReferenceItem[]>([]);
  const [immobilizations, setImmobilizations] = useState<ImmobilizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({ q: "", status: "all", page: 1, pageSize: 10 });
  const [correction, setCorrection] = useState({
    correctionType: "LOCATION_CHANGE" as InventoryCorrectionType,
    targetSpatialNodeId: "none",
    targetEquipmentStatusId: "none",
    targetImmobilizationId: "none",
    notes: ""
  });

  const loadData = useCallback(async () => {
    const status = query.status === "all" ? "" : `&status=${query.status}`;
    const search = query.q ? `&q=${encodeURIComponent(query.q)}` : "";
    const [anomalyResponse, nodeResponse, statusResponse, immobilizationResponse] = await Promise.all([
      apiFetch<PaginatedResponse<InventoryAnomalySummary>>(
        `/inventory-anomalies?page=${query.page}&pageSize=${query.pageSize}${status}${search}`
      ),
      apiFetch<PaginatedResponse<SpatialNodeListItem>>("/spatial/nodes?page=1&pageSize=200&sort=path&direction=asc&isActive=true"),
      apiFetch<EquipmentReferenceItem[]>("/assets/references/statuses?state=active"),
      apiFetch<PaginatedResponse<ImmobilizationSummary>>("/immobilizations?page=1&pageSize=200&sort=code&direction=asc")
    ]);
    setAnomalies(anomalyResponse);
    setNodes(nodeResponse.items);
    setStatuses(statusResponse);
    setImmobilizations(immobilizationResponse.items);
  }, [query.page, query.pageSize, query.q, query.status]);

  useEffect(() => {
    if (!token) return;
    void loadData().catch((loadError) => {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les anomalies");
      }
    });
  }, [loadData, token]);

  if (!token) {
    return <WebAuthScreen />;
  }

  const loadDetail = async (anomalyId: string) => {
    const detail = await apiFetch<InventoryAnomalyDetail>(`/inventory-anomalies/${anomalyId}`);
    setSelected(detail);
  };

  const proposeCorrection = async () => {
    if (!selected) return;
    const payload: CreateInventoryCorrectionInput = {
      correctionType: correction.correctionType,
      targetSpatialNodeId: correction.targetSpatialNodeId === "none" ? null : correction.targetSpatialNodeId,
      targetEquipmentStatusId: correction.targetEquipmentStatusId === "none" ? null : correction.targetEquipmentStatusId,
      targetImmobilizationId: correction.targetImmobilizationId === "none" ? null : correction.targetImmobilizationId,
      notes: correction.notes || null
    };
    try {
      await apiFetch(`/inventory-anomalies/${selected.id}/corrections`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadDetail(selected.id);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Correction impossible");
    }
  };

  const applyCorrection = async (correctionId: string) => {
    try {
      await apiFetch(`/inventory-anomalies/corrections/${correctionId}/apply`, { method: "POST", body: "{}" });
      if (selected) {
        await loadDetail(selected.id);
      }
      await loadData();
      setError(null);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Application correction impossible");
    }
  };

  return (
    <AppShell>
      <ListPage
        eyebrow="Anomalies"
        title="Anomalies terrain"
        description="Suivi des ecarts issus des campagnes et application des corrections superviseur."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => setQuery((current) => ({ ...current, q: value, page: 1 }))}
            searchPlaceholder="Rechercher par campagne, equipement ou localisation"
            filters={
              <Select value={query.status} onValueChange={(value) => setQuery((current) => ({ ...current, status: value ?? "all", page: 1 }))}>
                <SelectTrigger className="min-w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="REVIEWING">REVIEWING</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="DISMISSED">DISMISSED</SelectItem>
                </SelectContent>
              </Select>
            }
            actions={
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCwIcon className="size-4" />
                Rafraichir
              </Button>
            }
          />
        }
        grid={
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <PageSection title="Liste anomalies" description="Clique sur afficher pour traiter une anomalie.">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DataGrid
                rows={anomalies?.items ?? []}
                columns={[
                  { key: "type", label: "Type", render: (item) => item.type },
                  {
                    key: "status",
                    label: "Statut",
                    render: (item) => <StatusBadge status={item.status === "RESOLVED" ? "active" : "warning"} label={item.status} />
                  },
                  { key: "equipment", label: "Equipement", render: (item) => item.equipmentInternalCode ?? item.scannedCode ?? "-" },
                  { key: "expected", label: "Attendu", render: (item) => item.expectedSpatialPath ?? "-" },
                  { key: "observed", label: "Observe", render: (item) => item.observedSpatialPath ?? "-" }
                ]}
                getRowId={(item) => item.id}
                getMobileTitle={(item) => item.equipmentInternalCode ?? item.scannedCode ?? item.type}
                getMobileDescription={(item) => `${item.type} - ${item.status}`}
                rowActions={[{ label: "Afficher", onClick: (item) => void loadDetail(item.id) }]}
                emptyTitle="Aucune anomalie"
                emptyDescription="Les anomalies apparaitront apres execution de campagne."
              />
            </PageSection>

            <div className="space-y-6">
              <PageSection title="Detail anomalie" description="Constat et corrections rattachees.">
                {selected ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border/70 p-3">
                      <p className="font-semibold">{selected.type}</p>
                      <p className="text-sm text-muted-foreground">{selected.equipmentInternalCode ?? selected.scannedCode ?? "-"}</p>
                      <p className="text-sm text-muted-foreground">Attendu : {selected.expectedSpatialPath ?? "-"}</p>
                      <p className="text-sm text-muted-foreground">Observe : {selected.observedSpatialPath ?? "-"}</p>
                    </div>
                    {selected.corrections.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{item.correctionType}</p>
                          <StatusBadge status={item.status === "APPLIED" ? "active" : "neutral"} label={item.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{item.notes ?? "-"}</p>
                        {item.status !== "APPLIED" ? (
                          <Button size="sm" className="mt-2" onClick={() => void applyCorrection(item.id)}>
                            Appliquer
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Selectionne une anomalie.</p>
                )}
              </PageSection>

              <FormSection title="Proposer une correction" description="La correction reste explicite et auditee." columns={1}>
                <Field label="Type">
                  <Select
                    value={correction.correctionType}
                    onValueChange={(value) => setCorrection((current) => ({ ...current, correctionType: (value as InventoryCorrectionType) ?? "LOCATION_CHANGE" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCATION_CHANGE">Changement localisation</SelectItem>
                      <SelectItem value="STATUS_CHANGE">Changement statut</SelectItem>
                      <SelectItem value="RELABEL_REQUEST">Demande re-etiquetage</SelectItem>
                      <SelectItem value="MANUAL_IMMOBILIZATION_LINK">Lien immobilisation</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Noeud cible">
                  <Select value={correction.targetSpatialNodeId} onValueChange={(value) => setCorrection((current) => ({ ...current, targetSpatialNodeId: value ?? "none" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>{node.label} - {node.path}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Statut cible">
                  <Select value={correction.targetEquipmentStatusId} onValueChange={(value) => setCorrection((current) => ({ ...current, targetEquipmentStatusId: value ?? "none" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Immobilisation cible">
                  <Select value={correction.targetImmobilizationId} onValueChange={(value) => setCorrection((current) => ({ ...current, targetImmobilizationId: value ?? "none" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {immobilizations.map((immobilization) => (
                        <SelectItem key={immobilization.id} value={immobilization.id}>{immobilization.code} - {immobilization.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes">
                  <Textarea value={correction.notes} onChange={(event) => setCorrection((current) => ({ ...current, notes: event.target.value }))} />
                </Field>
                <Button disabled={!selected} onClick={() => void proposeCorrection()}>
                  <SaveIcon className="size-4" />
                  Proposer
                </Button>
              </FormSection>
            </div>
          </div>
        }
        pagination={null}
      />
    </AppShell>
  );
}
