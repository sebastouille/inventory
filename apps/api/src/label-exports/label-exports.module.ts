import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LabelExportsController } from "./label-exports.controller";
import { LabelExportsService } from "./label-exports.service";

@Module({
  imports: [AuthModule],
  controllers: [LabelExportsController],
  providers: [LabelExportsService]
})
export class LabelExportsModule {}
