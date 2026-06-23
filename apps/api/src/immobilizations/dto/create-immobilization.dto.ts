import { IsISO8601, IsNumberString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateImmobilizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  costCenter?: string | null;

  @IsOptional()
  @IsNumberString()
  purchaseValue?: string | null;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string | null;

  @IsOptional()
  @IsISO8601()
  serviceStartAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceSystem?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string | null;
}
