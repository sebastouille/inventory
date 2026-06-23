import { IsOptional, IsString, MaxLength } from "class-validator";

export class GlobalSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q = "";
}
