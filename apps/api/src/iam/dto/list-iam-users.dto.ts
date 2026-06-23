import { IsIn, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../common/list-query.dto";

export class ListIamUsersDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["name", "email", "createdAt"])
  override sort: "name" | "email" | "createdAt" = "createdAt";

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";
}
