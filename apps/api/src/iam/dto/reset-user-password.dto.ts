import { Type } from "class-transformer";
import { IsString, MinLength } from "class-validator";

export class ResetUserPasswordDto {
  @Type(() => String)
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;
}
