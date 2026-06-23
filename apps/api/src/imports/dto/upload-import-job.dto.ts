import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { IMPORT_SOURCE_KINDS, type ImportSourceKind } from "@inventory/shared";

export class UploadImportJobDto {
  @IsOptional()
  @IsIn(IMPORT_SOURCE_KINDS)
  sourceKind?: ImportSourceKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headerRowIndex?: number;
}
