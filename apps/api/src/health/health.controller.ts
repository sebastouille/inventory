import { Controller, Get, Res } from "@nestjs/common";
import type { ApiHealthResponse } from "@inventory/shared";
import type { Response } from "express";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res() response: Response): Promise<Response<ApiHealthResponse>> {
    const result = await this.healthService.getHealth();
    return response.status(result.code).json(result.body);
  }
}
