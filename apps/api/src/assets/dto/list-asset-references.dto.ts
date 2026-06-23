import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ListAssetReferencesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(["all", "active", "inactive"])
  state?: "all" | "active" | "inactive";
}
