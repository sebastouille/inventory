import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthContextService } from "./auth-context.service";
import { AuthService } from "./auth.service";
import { JwtGuard } from "./jwt.guard";
import { PermissionsGuard } from "./permissions.guard";

@Global()
@Module({
  imports: [
    AuditModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-change-me",
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m") as never
      }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthContextService, JwtGuard, PermissionsGuard],
  exports: [JwtGuard, PermissionsGuard, JwtModule, AuthService, AuthContextService]
})
export class AuthModule {}
