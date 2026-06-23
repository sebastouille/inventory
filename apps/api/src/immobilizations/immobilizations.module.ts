import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ImmobilizationsController } from "./immobilizations.controller";
import { ImmobilizationsRepository } from "./immobilizations.repository";
import { ImmobilizationsService } from "./immobilizations.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ImmobilizationsController],
  providers: [ImmobilizationsService, ImmobilizationsRepository],
  exports: [ImmobilizationsService, ImmobilizationsRepository]
})
export class ImmobilizationsModule {}
