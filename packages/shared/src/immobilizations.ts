import type { ExportableListQuery } from "./listing";

export interface ImmobilizationSummary {
  id: string;
  code: string;
  label: string;
  description: string | null;
  status: string | null;
  costCenter: string | null;
  purchaseValue: string | null;
  purchaseDate: string | null;
  serviceStartAt: string | null;
  sourceSystem: string | null;
  externalRef: string | null;
  isActive: boolean;
  equipmentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImmobilizationEquipmentSummary {
  id: string;
  internalCode: string;
  serialNumber: string | null;
  isDeleted: boolean;
  equipmentTypeLabel: string;
  equipmentStatusLabel: string;
  currentSpatialLabel: string | null;
  currentSpatialPath: string | null;
}

export interface ImmobilizationDetail extends ImmobilizationSummary {
  initializedByImportJobId: string | null;
  equipments: ImmobilizationEquipmentSummary[];
}

export interface CreateImmobilizationInput {
  code: string;
  label: string;
  description?: string | null;
  status?: string | null;
  costCenter?: string | null;
  purchaseValue?: string | null;
  purchaseDate?: string | null;
  serviceStartAt?: string | null;
  sourceSystem?: string | null;
  externalRef?: string | null;
}

export interface UpdateImmobilizationInput extends Partial<CreateImmobilizationInput> {}

export interface ImmobilizationListQuery extends ExportableListQuery {
  sort?:
    | "code"
    | "label"
    | "status"
    | "costCenter"
    | "createdAt"
    | "updatedAt"
    | "equipmentsCount";
  isActive?: "true" | "false";
}
