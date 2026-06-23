import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { UserRoleAssignmentDto } from "./create-user.dto";

export class ReplaceUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserRoleAssignmentDto)
  roleAssignments!: UserRoleAssignmentDto[];
}
