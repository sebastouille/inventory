import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Bim3dService } from "./bim-3d.service";
import { BuildBim3dMapDto } from "./dto/build-bim-3d-map.dto";

interface UploadedIfcFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype?: string;
}

@ApiTags("bim-3d")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("bim-3d/maps")
export class Bim3dController {
  constructor(private readonly bim3dService: Bim3dService) {}

  @RequirePermissions("bim3d.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser) {
    return this.bim3dService.listMaps(auth.organizationId);
  }

  @RequirePermissions("bim3d.build")
  @Post("build")
  build(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: BuildBim3dMapDto) {
    return this.bim3dService.buildMap(auth, dto);
  }

  @RequirePermissions("bim3d.build")
  @Post("build-ifc")
  @UseInterceptors(FileInterceptor("file"))
  buildIfc(
    @CurrentAuth() auth: AuthenticatedUser,
    @UploadedFile() file: UploadedIfcFile | undefined,
    @Body() body: Record<string, string | undefined>
  ) {
    return this.bim3dService.buildIfcMap(auth, file, body);
  }

  @RequirePermissions("bim3d.read")
  @Get(":mapId/scene")
  scene(@CurrentAuth() auth: AuthenticatedUser, @Param("mapId") mapId: string) {
    return this.bim3dService.getScene(auth.organizationId, mapId);
  }

  @RequirePermissions("bim3d.read")
  @Get(":mapId/history")
  history(@CurrentAuth() auth: AuthenticatedUser, @Param("mapId") mapId: string) {
    return this.bim3dService.history(auth.organizationId, mapId);
  }

  @RequirePermissions("bim3d.manage")
  @Post(":mapId/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("mapId") mapId: string) {
    return this.bim3dService.archive(auth, mapId);
  }

  @RequirePermissions("bim3d.read")
  @Get(":mapId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("mapId") mapId: string) {
    return this.bim3dService.getMap(auth.organizationId, mapId);
  }
}
