import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { StockMovementsController } from "./stock-movements.controller";
import { StockMovementsService } from "./stock-movements.service";

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [StockMovementsController],
  providers: [StockMovementsService]
})
export class StockMovementsModule {}
