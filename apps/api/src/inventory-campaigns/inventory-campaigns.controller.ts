import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "../swagger-compat";
import type {
  CompleteInventoryNodeInput,
  CreateInventoryCampaignInput,
  InventoryCampaignListQuery,
  InventoryCampaignSyncInput,
  UpdateInventoryCampaignInput
} from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { InventoryCampaignsService } from "./inventory-campaigns.service";

@ApiTags("inventory-campaigns")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("inventory-campaigns")
export class InventoryCampaignsController {
  constructor(private readonly campaignsService: InventoryCampaignsService) {}

  @RequirePermissions("campaigns.read")
  @Get()
  list(@CurrentAuth() auth: AuthenticatedUser, @Query() query: InventoryCampaignListQuery) {
    return this.campaignsService.list(auth.organizationId, query);
  }

  @RequirePermissions("campaigns.create")
  @Post()
  create(@CurrentAuth() auth: AuthenticatedUser, @Body() input: CreateInventoryCampaignInput) {
    return this.campaignsService.create(auth, input);
  }

  @RequirePermissions("campaigns.read")
  @Get(":campaignId")
  detail(@CurrentAuth() auth: AuthenticatedUser, @Param("campaignId") campaignId: string) {
    return this.campaignsService.detail(auth.organizationId, campaignId);
  }

  @RequirePermissions("campaigns.update")
  @Patch(":campaignId")
  update(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("campaignId") campaignId: string,
    @Body() input: UpdateInventoryCampaignInput
  ) {
    return this.campaignsService.update(auth, campaignId, input);
  }

  @RequirePermissions("campaigns.read")
  @Post(":campaignId/preview-expected")
  previewExpected(@CurrentAuth() auth: AuthenticatedUser, @Param("campaignId") campaignId: string) {
    return this.campaignsService.previewExpected(auth.organizationId, campaignId);
  }

  @RequirePermissions("campaigns.update")
  @Post(":campaignId/open")
  open(@CurrentAuth() auth: AuthenticatedUser, @Param("campaignId") campaignId: string) {
    return this.campaignsService.open(auth, campaignId);
  }

  @RequirePermissions("campaigns.review")
  @Post(":campaignId/close")
  close(@CurrentAuth() auth: AuthenticatedUser, @Param("campaignId") campaignId: string) {
    return this.campaignsService.close(auth, campaignId);
  }

  @RequirePermissions("campaigns.archive")
  @Post(":campaignId/archive")
  archive(@CurrentAuth() auth: AuthenticatedUser, @Param("campaignId") campaignId: string) {
    return this.campaignsService.archive(auth, campaignId);
  }

  @RequirePermissions("campaigns.execute")
  @Post(":campaignId/sync")
  sync(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("campaignId") campaignId: string,
    @Body() input: InventoryCampaignSyncInput
  ) {
    return this.campaignsService.sync(auth, campaignId, input);
  }

  @RequirePermissions("campaigns.execute")
  @Post(":campaignId/complete-node")
  completeNode(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("campaignId") campaignId: string,
    @Body() input: CompleteInventoryNodeInput
  ) {
    return this.campaignsService.completeNode(auth, campaignId, input);
  }
}
