import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { InventoryCampaignsController } from "./inventory-campaigns.controller";
import { InventoryCampaignsService } from "./inventory-campaigns.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [InventoryCampaignsController],
  providers: [InventoryCampaignsService],
  exports: [InventoryCampaignsService]
})
export class InventoryCampaignsModule {}
