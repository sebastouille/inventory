import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService]
})
export class ReconciliationModule {}
