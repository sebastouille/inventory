import { IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/list-query.dto";

export class ListIamRolesDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["label", "code"])
  override sort: "label" | "code" = "label";
}
