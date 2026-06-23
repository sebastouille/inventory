import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CreateSpatialNodeDto } from "./dto/create-spatial-node.dto";
import { ListSpatialNodesDto } from "./dto/list-spatial-nodes.dto";
import { UpdateSpatialNodeDto } from "./dto/update-spatial-node.dto";
import { SpatialService } from "./spatial.service";

@ApiTags("spatial")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("spatial/nodes")
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  @RequirePermissions("spatial.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListSpatialNodesDto) {
    return this.spatialService.list(auth.organizationId, query);
  }

  @RequirePermissions("spatial.manage")
  @Post()
  create(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateSpatialNodeDto) {
    return this.spatialService.create(auth, dto);
  }

  @RequirePermissions("spatial.read")
  @Get("tree")
  tree(@CurrentAuth() auth: AuthenticatedUser, @Query("ancestorId") ancestorId?: string) {
    return this.spatialService.getTree(auth.organizationId, ancestorId);
  }

  @RequirePermissions("spatial.read")
  @Get("summary")
  summary(@CurrentAuth() auth: AuthenticatedUser) {
    return this.spatialService.getSummary(auth.organizationId);
  }

  @RequirePermissions("spatial.read")
  @Get("display-settings")
  displaySettings(@CurrentAuth() auth: AuthenticatedUser) {
    return this.spatialService.getDisplaySettings(auth.organizationId);
  }

  @RequirePermissions("spatial.read")
  @Get(":nodeId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("nodeId") nodeId: string) {
    return this.spatialService.getDetail(auth.organizationId, nodeId);
  }

  @RequirePermissions("spatial.manage")
  @Patch(":nodeId")
  update(@CurrentAuth() auth: AuthenticatedUser, @Param("nodeId") nodeId: string, @Body() dto: UpdateSpatialNodeDto) {
    return this.spatialService.update(auth, nodeId, dto);
  }

  @RequirePermissions("spatial.manage")
  @Post(":nodeId/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("nodeId") nodeId: string) {
    return this.spatialService.archive(auth, nodeId);
  }
}
