import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import type { Bim3dBuildMapInput } from "@inventory/shared";

export class BuildBim3dMapDto implements Bim3dBuildMapInput {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  importJobId?: string | null;

  @IsOptional()
  @IsIn(["simplified"])
  mode?: "simplified";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  maxNodeDepth?: number | null;

  @IsOptional()
  @IsBoolean()
  includeEquipments?: boolean;
}
