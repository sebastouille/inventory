import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateEquipmentReferenceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isGeneric?: boolean;
}
