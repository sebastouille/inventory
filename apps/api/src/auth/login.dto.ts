import { ApiProperty } from "../swagger-compat";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "demo-org" })
  @IsString()
  organizationSlug!: string;

  @ApiProperty({ example: "admin@demo.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}
