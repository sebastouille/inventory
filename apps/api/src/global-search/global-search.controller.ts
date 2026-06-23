import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { GlobalSearchQueryDto } from "./dto/global-search-query.dto";
import { GlobalSearchService } from "./global-search.service";

@ApiTags("global-search")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("search")
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get("global")
  search(@CurrentAuth() auth: AuthenticatedUser, @Query() query: GlobalSearchQueryDto) {
    return this.globalSearchService.search(auth, query.q ?? "");
  }
}
