import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { IamController } from "./iam.controller";
import { IamRolesRepository } from "./iam-roles.repository";
import { IamScopesRepository } from "./iam-scopes.repository";
import { IamService } from "./iam.service";
import { IamUsersRepository } from "./iam-users.repository";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [IamController],
  providers: [IamService, IamUsersRepository, IamRolesRepository, IamScopesRepository],
  exports: [IamService]
})
export class IamModule {}
