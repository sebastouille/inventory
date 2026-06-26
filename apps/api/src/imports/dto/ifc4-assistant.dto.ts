import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import {
  IFC4_GEOMETRY_LEVELS,
  IFC4_IMPORT_POLICIES,
  type Ifc4GeometryLevel,
  type Ifc4ImportPolicy
} from "@inventory/shared";

export class Ifc4AssistantDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  selectedClasses?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedProperties?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maxProducts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  geometryLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  maxShapeParts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  importPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultStatusCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultOwnerEntityCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  spatialOverrides?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  assetReferenceOverrides?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  equipmentOptions?: string;
}

export class Ifc4AssistantProfileDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  selectedClasses!: string[];

  @IsArray()
  selectedProperties!: string[];

  @IsOptional()
  @IsObject()
  spatialMappings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  equipmentMappings?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  assetReferenceOverrides?: unknown[];

  @IsOptional()
  @IsArray()
  spatialTypeOverrides?: unknown[];

  @IsIn(IFC4_GEOMETRY_LEVELS)
  geometryLevel!: Ifc4GeometryLevel;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200000)
  maxProducts!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  maxShapeParts!: number;

  @IsIn(IFC4_IMPORT_POLICIES)
  importPolicy!: Ifc4ImportPolicy;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
