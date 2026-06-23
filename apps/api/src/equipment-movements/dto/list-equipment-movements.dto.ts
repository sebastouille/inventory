import { IsIn, IsOptional, IsUUID } from "class-validator";
import { ExportListQueryDto } from "../../common/list-query.dto";

export class ListEquipmentMovementsDto extends ExportListQueryDto {
  @IsOptional()
  @IsIn(["createdAt", "movementType", "source", "equipmentInternalCode"])
  override sort:
    | "createdAt"
    | "movementType"
    | "source"
    | "equipmentInternalCode"
    | undefined = undefined;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsIn(["INITIAL_STATE", "LOCATION_CHANGED", "ASSIGNMENT_ADDED", "ASSIGNMENT_REMOVED", "ASSIGNMENT_CHANGED"])
  movementType?: "INITIAL_STATE" | "LOCATION_CHANGED" | "ASSIGNMENT_ADDED" | "ASSIGNMENT_REMOVED" | "ASSIGNMENT_CHANGED";

  @IsOptional()
  @IsIn(["USER", "IMPORT", "SYSTEM"])
  source?: "USER" | "IMPORT" | "SYSTEM";
}
