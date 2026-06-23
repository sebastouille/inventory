import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { EquipmentMovementsModule } from "../equipment-movements/equipment-movements.module";
import { SpatialModule } from "../spatial/spatial.module";
import { IfcGeometryWorker } from "../bim-3d/ifc-geometry-worker";
import { EquipmentsImportService } from "./equipments-import.service";
import { Ifc4AssistantService } from "./ifc4-assistant.service";
import { ImmobilizationsImportService } from "./immobilizations-import.service";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [AuthModule, AuditModule, SpatialModule, EquipmentMovementsModule],
  controllers: [ImportsController],
  providers: [ImportsService, EquipmentsImportService, ImmobilizationsImportService, Ifc4AssistantService, IfcGeometryWorker],
  exports: [ImportsService]
})
export class ImportsModule {}
