import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

export class ListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @IsIn([...PAGE_SIZE_OPTIONS])
  pageSize = 10;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  direction = "asc" as const;
}

export class ExportListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["ods"])
  format = "ods" as const;
}
