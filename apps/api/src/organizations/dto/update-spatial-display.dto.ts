import type { UpdateOrganizationSpatialDisplayInput } from "@inventory/shared";

export class UpdateSpatialDisplayDto implements UpdateOrganizationSpatialDisplayInput {
  spatialDisplay!: UpdateOrganizationSpatialDisplayInput["spatialDisplay"];
}
