import { IsIn, IsOptional } from "class-validator";
import { ExportListQueryDto } from "../../common/list-query.dto";

export class ListImmobilizationsDto extends ExportListQueryDto {
  @IsOptional()
  @IsIn(["code", "label", "status", "costCenter", "createdAt", "updatedAt", "equipmentsCount"])
  override sort:
    | "code"
    | "label"
    | "status"
    | "costCenter"
    | "createdAt"
    | "updatedAt"
    | "equipmentsCount"
    | undefined = undefined;

  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";
}
