import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsObject, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { ImportMappingDto } from "./create-import-profile.dto";

export class RunImportJobDto {
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @IsOptional()
  @Type(() => ImportMappingDto)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  overrideMappings?: ImportMappingDto[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
