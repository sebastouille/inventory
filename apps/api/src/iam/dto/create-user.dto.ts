import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested
} from "class-validator";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserRoleAssignmentDto {
  @IsString()
  @Matches(UUID_PATTERN)
  roleId!: string;

  @IsOptional()
  @IsString()
  @Matches(UUID_PATTERN)
  scopeId?: string | null;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserRoleAssignmentDto)
  roleAssignments!: UserRoleAssignmentDto[];
}
