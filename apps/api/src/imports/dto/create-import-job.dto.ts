import { IsIn, IsOptional, IsUUID } from "class-validator";
import { IMPORT_TARGET_DOMAINS, type ImportTargetDomain } from "@inventory/shared";

export class CreateImportJobDto {
  @IsOptional()
  @IsIn(IMPORT_TARGET_DOMAINS)
  targetDomain?: ImportTargetDomain;

  @IsOptional()
  @IsUUID()
  profileId?: string;
}
