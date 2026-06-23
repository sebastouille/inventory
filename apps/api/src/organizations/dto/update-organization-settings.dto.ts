import type { UpdateOrganizationSettingsInput } from "@inventory/shared";

export class UpdateOrganizationSettingsDto implements UpdateOrganizationSettingsInput {
  iam!: UpdateOrganizationSettingsInput["iam"];
  spatialDisplay!: UpdateOrganizationSettingsInput["spatialDisplay"];
}
