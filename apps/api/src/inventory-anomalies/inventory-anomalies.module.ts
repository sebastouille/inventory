import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { InventoryAnomaliesController } from "./inventory-anomalies.controller";
import { InventoryAnomaliesService } from "./inventory-anomalies.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InventoryAnomaliesController],
  providers: [InventoryAnomaliesService]
})
export class InventoryAnomaliesModule {}
