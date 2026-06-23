import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { EquipmentMovementsModule } from "../equipment-movements/equipment-movements.module";
import { AssetReferencesController } from "./asset-references.controller";
import { AssetReferencesRepository } from "./asset-references.repository";
import { AssetReferencesService } from "./asset-references.service";
import { AssetsController } from "./assets.controller";
import { AssetsRepository } from "./assets.repository";
import { AssetsService } from "./assets.service";

@Module({
  imports: [AuthModule, AuditModule, EquipmentMovementsModule],
  controllers: [AssetsController, AssetReferencesController],
  providers: [AssetsService, AssetReferencesService, AssetsRepository, AssetReferencesRepository]
})
export class AssetsModule {}
