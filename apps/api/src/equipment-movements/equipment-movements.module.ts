import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EquipmentMovementsController } from "./equipment-movements.controller";
import { EquipmentMovementsRepository } from "./equipment-movements.repository";
import { EquipmentMovementsService } from "./equipment-movements.service";

@Module({
  imports: [AuthModule],
  controllers: [EquipmentMovementsController],
  providers: [EquipmentMovementsService, EquipmentMovementsRepository],
  exports: [EquipmentMovementsService, EquipmentMovementsRepository]
})
export class EquipmentMovementsModule {}
