import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { SpatialController } from "./spatial.controller";
import { SpatialService } from "./spatial.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SpatialController],
  providers: [SpatialService],
  exports: [SpatialService]
})
export class SpatialModule {}
