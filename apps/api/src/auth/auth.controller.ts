import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { AuthService } from "./auth.service";
import { CompletePasswordChangeDto } from "./complete-password-change.dto";
import { CurrentAuth } from "./current-auth.decorator";
import type { AuthenticatedUser } from "./auth.types";
import { JwtGuard } from "./jwt.guard";
import { LoginDto } from "./login.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("complete-password-change")
  completePasswordChange(@Body() dto: CompletePasswordChangeDto) {
    return this.authService.completePasswordChange(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get("me")
  me(@CurrentAuth() auth: AuthenticatedUser) {
    return this.authService.me(auth);
  }
}
