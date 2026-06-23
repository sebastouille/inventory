import { ApiProperty } from "../swagger-compat";
import { StockMovementType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateStockMovementDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty()
  @IsInt()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
