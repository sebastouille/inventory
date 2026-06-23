import { IsUUID } from "class-validator";

export class CreateAttachmentRuleDto {
  @IsUUID()
  sourceFamilyId!: string;

  @IsUUID()
  targetFamilyId!: string;
}
