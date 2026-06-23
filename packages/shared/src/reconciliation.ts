export interface ReconciliationCandidate {
  immobilizationId: string;
  code: string;
  label: string;
  status: string | null;
  score: number;
  reasons: string[];
}

export interface EquipmentReconciliationResponse {
  equipmentId: string;
  internalCode: string;
  label: string;
  numPiece: string | null;
  externalRef: string | null;
  currentImmobilizationId: string | null;
  currentImmobilizationCode: string | null;
  currentImmobilizationLabel: string | null;
  candidates: ReconciliationCandidate[];
}

export interface LinkEquipmentImmobilizationInput {
  immobilizationId: string;
  reason?: string | null;
}

export interface UnlinkEquipmentImmobilizationInput {
  reason?: string | null;
}
