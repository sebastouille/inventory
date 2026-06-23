import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { Bim3dController } from "./bim-3d.controller";
import { Bim3dRepository } from "./bim-3d.repository";
import { Bim3dService } from "./bim-3d.service";
import { IfcGeometryWorker } from "./ifc-geometry-worker";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [Bim3dController],
  providers: [Bim3dService, Bim3dRepository, IfcGeometryWorker]
})
export class Bim3dModule {}
