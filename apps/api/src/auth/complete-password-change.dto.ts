import { ApiProperty } from "../swagger-compat";
import { IsString, MinLength } from "class-validator";

export class CompletePasswordChangeDto {
  @ApiProperty()
  @IsString()
  passwordChangeToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
