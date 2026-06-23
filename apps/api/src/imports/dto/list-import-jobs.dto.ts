import { IsIn, IsOptional, IsUUID } from "class-validator";
import { IMPORT_JOB_STATUSES, IMPORT_TARGET_DOMAINS, type ImportJobStatus, type ImportTargetDomain } from "@inventory/shared";
import { ListQueryDto } from "../../common/list-query.dto";

export class ListImportJobsDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "status", "targetDomain"])
  override sort: "createdAt" | "updatedAt" | "status" | "targetDomain" | undefined = undefined;

  @IsOptional()
  @IsIn(IMPORT_TARGET_DOMAINS)
  targetDomain?: ImportTargetDomain;

  @IsOptional()
  @IsIn(IMPORT_JOB_STATUSES)
  status?: ImportJobStatus;

  @IsOptional()
  @IsUUID()
  profileId?: string;
}
