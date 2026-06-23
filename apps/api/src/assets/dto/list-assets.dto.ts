import { IsIn, IsOptional, IsUUID } from "class-validator";
import { ExportListQueryDto } from "../../common/list-query.dto";

export class ListAssetsDto extends ExportListQueryDto {
  @IsOptional()
  @IsIn([
    "internalCode",
    "serialNumber",
    "createdAt",
    "updatedAt",
    "statusLabel",
    "ownerLabel",
    "immobilizationCode"
  ])
  override sort:
    | "internalCode"
    | "serialNumber"
    | "createdAt"
    | "updatedAt"
    | "statusLabel"
    | "ownerLabel"
    | "immobilizationCode"
    | undefined = undefined;

  @IsOptional()
  @IsUUID()
  familyId?: string;

  @IsOptional()
  @IsUUID()
  subfamilyId?: string;

  @IsOptional()
  @IsUUID()
  typeId?: string;

  @IsOptional()
  @IsUUID()
  statusId?: string;

  @IsOptional()
  @IsUUID()
  ownerEntityId?: string;

  @IsOptional()
  @IsUUID()
  immobilizationId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  isArchived?: "true" | "false";
}
