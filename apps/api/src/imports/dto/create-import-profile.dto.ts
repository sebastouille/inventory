import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import {
  IMPORT_MATCH_POLICIES,
  IMPORT_SOURCE_KINDS,
  IMPORT_TARGET_DOMAINS,
  IMPORT_TRANSFORM_TYPES,
  type ImportMatchPolicy,
  type ImportSourceKind,
  type ImportTargetDomain,
  type ImportTransformType
} from "@inventory/shared";

export class ImportMappingDto {
  @IsString()
  @MaxLength(200)
  sourceColumn!: string;

  @IsString()
  @MaxLength(200)
  targetField!: string;

  @IsIn(IMPORT_TRANSFORM_TYPES)
  transformType!: ImportTransformType;

  @IsOptional()
  @IsObject()
  transformConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsIn(IMPORT_MATCH_POLICIES)
  matchPolicy?: ImportMatchPolicy;
}

export class CreateImportProfileDto {
  @IsIn(IMPORT_TARGET_DOMAINS)
  targetDomain!: ImportTargetDomain;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(IMPORT_SOURCE_KINDS)
  sourceKind!: ImportSourceKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headerRowIndex = 1;

  @Type(() => ImportMappingDto)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  mappings!: ImportMappingDto[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
