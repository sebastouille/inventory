import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";

const ASSET_ASSIGNMENT_TYPES = ["PERSON", "LOCATION", "ASSET"] as const;

export class AssetAssignmentDto {
  @IsIn([...ASSET_ASSIGNMENT_TYPES])
  assignmentType!: (typeof ASSET_ASSIGNMENT_TYPES)[number];

  @IsOptional()
  @IsUUID()
  targetUserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetPersonName?: string | null;

  @IsOptional()
  @IsUUID()
  targetLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  targetEquipmentId?: string | null;

  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateAssetDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  internalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numPiece?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  serialNumber?: string | null;

  @IsUUID()
  equipmentTypeId!: string;

  @IsOptional()
  @IsUUID()
  equipmentModelId?: string | null;

  @IsUUID()
  equipmentStatusId!: string;

  @IsUUID()
  ownerEntityId!: string;

  @IsOptional()
  @IsUUID()
  currentSpatialNodeId?: string | null;

  @IsOptional()
  @IsUUID()
  immobilizationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  technicalCharacteristics?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  receivedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  commissionedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  lastInventoryAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AssetAssignmentDto)
  assignments?: AssetAssignmentDto[];
}
