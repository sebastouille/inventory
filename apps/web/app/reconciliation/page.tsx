"use client";

import type { AssetListItem, EquipmentReconciliationResponse, ImmobilizationSummary, PaginatedResponse } from "@inventory/shared";
import { Button, DataGrid, Field, FilterBar, FormSection, ListPage, PageSection, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@inventory/ui";
import { LinkIcon, RefreshCwIcon, UnlinkIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WebAuthScreen } from "@/components/web-auth-screen";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function ReconciliationPage() {
  const token = useStoredToken();
  const [assets, setAssets] = useState<PaginatedResponse<AssetListItem> | null>(null);
  const [immobilizations, setImmobilizations] = useState<ImmobilizationSummary[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedImmobilizationId, setSelectedImmobilizationId] = useState("none");
  const [detail, setDetail] = useState<EquipmentReconciliationResponse | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [assetResponse, immobilizationResponse] = await Promise.all([
      apiFetch<PaginatedResponse<AssetListItem>>(`/assets?page=1&pageSize=50&q=${encodeURIComponent(q)}`),
      apiFetch<PaginatedResponse<ImmobilizationSummary>>("/immobilizations?page=1&pageSize=500&sort=code&direction=asc")
    ]);
    setAssets(assetResponse);
    setImmobilizations(immobilizationResponse.items);
  }, [q]);

  useEffect(() => {
    if (!token) return;
    void loadData().catch((loadError) => {
      if (!isUnauthorizedApiError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Chargement rapprochement impossible");
      }
    });
  }, [loadData, token]);

  if (!token) {
    return <WebAuthScreen />;
  }

  const loadDetail = async (equipmentId: string) => {
    const response = await apiFetch<EquipmentReconciliationResponse>(`/reconciliation/equipment/${equipmentId}`);
    setSelectedEquipmentId(equipmentId);
    setDetail(response);
    setSelectedImmobilizationId(response.currentImmobilizationId ?? "none");
  };

  const link = async () => {
    if (!selectedEquipmentId || selectedImmobilizationId === "none") return;
    const response = await apiFetch<EquipmentReconciliationResponse>(`/reconciliation/equipment/${selectedEquipmentId}/link`, {
      method: "POST",
      body: JSON.stringify({ immobilizationId: selectedImmobilizationId })
    });
    setDetail(response);
  };

  const unlink = async () => {
    if (!selectedEquipmentId) return;
    const response = await apiFetch<EquipmentReconciliationResponse>(`/reconciliation/equipment/${selectedEquipmentId}/unlink`, {
      method: "POST",
      body: "{}"
    });
    setDetail(response);
    setSelectedImmobilizationId("none");
  };

  return (
    <AppShell>
      <ListPage
        eyebrow="Rapprochement"
        title="Rapprochement manuel"
        description="Rattachement manuel entre equipements physiques et immobilisations comptables."
        filters={
          <FilterBar
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="Rechercher un equipement"
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
            <PageSection title="Equipements" description="Selectionne l equipement a rapprocher.">
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DataGrid
                rows={assets?.items ?? []}
                columns={[
                  { key: "internalCode", label: "Code", render: (item) => item.internalCode },
                  { key: "type", label: "Type", render: (item) => item.equipmentType.label },
                  { key: "immobilization", label: "Immobilisation", render: (item) => item.immobilizationCode ?? "-" }
                ]}
                getRowId={(item) => item.id}
                getMobileTitle={(item) => item.internalCode}
                getMobileDescription={(item) => item.equipmentType.label}
                rowActions={[{ label: "Rapprocher", onClick: (item) => void loadDetail(item.id) }]}
                emptyTitle="Aucun equipement"
                emptyDescription="Aucun equipement ne correspond a la recherche."
              />
            </PageSection>

            <div className="space-y-6">
              <PageSection title="Situation courante" description="Lien comptable actuellement enregistre.">
                {detail ? (
                  <div className="space-y-2">
                    <p className="font-semibold">{detail.internalCode}</p>
                    <p className="text-sm text-muted-foreground">{detail.label}</p>
                    <p className="text-sm">
                      Immobilisation : {detail.currentImmobilizationCode ? `${detail.currentImmobilizationCode} - ${detail.currentImmobilizationLabel}` : "aucune"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Selectionne un equipement.</p>
                )}
              </PageSection>

              <FormSection title="Rattachement manuel" description="Aucune decision automatique n est appliquee." columns={1}>
                <Field label="Immobilisation cible">
                  <Select value={selectedImmobilizationId} onValueChange={(value) => setSelectedImmobilizationId(value ?? "none")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {immobilizations.map((immobilization) => (
                        <SelectItem key={immobilization.id} value={immobilization.id}>
                          {immobilization.code} - {immobilization.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button disabled={!detail || selectedImmobilizationId === "none"} onClick={() => void link()}>
                    <LinkIcon className="size-4" />
                    Rattacher
                  </Button>
                  <Button variant="outline" disabled={!detail?.currentImmobilizationId} onClick={() => void unlink()}>
                    <UnlinkIcon className="size-4" />
                    Detacher
                  </Button>
                </div>
              </FormSection>

              <PageSection title="Candidats informatifs" description="Aides de lecture, sans affectation automatique.">
                <div className="space-y-2">
                  {(detail?.candidates ?? []).map((candidate) => (
                    <button
                      key={candidate.immobilizationId}
                      type="button"
                      className="w-full rounded-xl border border-border/70 p-3 text-left hover:bg-muted/50"
                      onClick={() => setSelectedImmobilizationId(candidate.immobilizationId)}
                    >
                      <p className="font-medium">{candidate.code} - {candidate.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Score {candidate.score} - {candidate.reasons.join(", ") || "candidat informatif"}
                      </p>
                    </button>
                  ))}
                  {detail && detail.candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun candidat informatif.</p>
                  ) : null}
                </div>
              </PageSection>
            </div>
          </div>
        }
        pagination={null}
      />
    </AppShell>
  );
}
