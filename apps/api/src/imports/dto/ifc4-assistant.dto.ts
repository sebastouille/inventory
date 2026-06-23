import { IsOptional, IsString, MaxLength } from "class-validator";

export class Ifc4AssistantDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  selectedClasses?: string;

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
