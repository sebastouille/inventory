import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { SPATIAL_NODE_TYPES, type SpatialNodeType } from "@inventory/shared";

export class CreateSpatialNodeDto {
  @IsIn(SPATIAL_NODE_TYPES)
  type!: SpatialNodeType;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceClass?: string | null;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  sourceMetadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
