import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import {
  SPATIAL_NODE_LIST_MAX_PAGE_SIZE,
  SPATIAL_NODE_TYPES,
  type SpatialNodeType
} from "@inventory/shared";

export class ListSpatialNodesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SPATIAL_NODE_LIST_MAX_PAGE_SIZE)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(["path", "code", "label", "type", "createdAt", "updatedAt"])
  sort?: "path" | "code" | "label" | "type" | "createdAt" | "updatedAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  direction?: "asc" | "desc";

  @IsOptional()
  @IsIn(SPATIAL_NODE_TYPES)
  type?: SpatialNodeType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  ancestorId?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";
}
