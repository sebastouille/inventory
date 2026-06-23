import { PartialType } from "@nestjs/mapped-types";
import { CreateImmobilizationDto } from "./create-immobilization.dto";

export class UpdateImmobilizationDto extends PartialType(CreateImmobilizationDto) {}
