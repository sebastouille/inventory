import { IsIn, IsOptional } from "class-validator";
import { IMPORT_TARGET_DOMAINS, type ImportTargetDomain } from "@inventory/shared";
import { ListQueryDto } from "../../common/list-query.dto";

export class ListImportProfilesDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["name", "targetDomain", "createdAt", "updatedAt"])
  override sort: "name" | "targetDomain" | "createdAt" | "updatedAt" | undefined = undefined;

  @IsOptional()
  @IsIn(IMPORT_TARGET_DOMAINS)
  targetDomain?: ImportTargetDomain;

  @IsOptional()
  @IsIn(["true", "false"])
  isArchived?: "true" | "false";
}
