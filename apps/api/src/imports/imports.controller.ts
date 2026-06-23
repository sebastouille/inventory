import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "../swagger-compat";
import { IMPORT_TARGET_DOMAINS, type ImportTargetDomain } from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CreateImportJobDto } from "./dto/create-import-job.dto";
import { CreateImportProfileDto } from "./dto/create-import-profile.dto";
import { Ifc4AssistantDto } from "./dto/ifc4-assistant.dto";
import { ListImportJobsDto } from "./dto/list-import-jobs.dto";
import { ListImportProfilesDto } from "./dto/list-import-profiles.dto";
import { RunImportJobDto } from "./dto/run-import-job.dto";
import { UpdateImportProfileDto } from "./dto/update-import-profile.dto";
import { UploadImportJobDto } from "./dto/upload-import-job.dto";
import { Ifc4AssistantService } from "./ifc4-assistant.service";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller("imports")
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly ifc4AssistantService: Ifc4AssistantService
  ) {}

  @RequirePermissions("imports.read")
  @Get("targets/:targetDomain/fields")
  listTargetFields(
    @Param("targetDomain") targetDomain: string
  ) {
    if (!IMPORT_TARGET_DOMAINS.includes(targetDomain as ImportTargetDomain)) {
      throw new BadRequestException("Unknown target domain");
    }
    return this.importsService.listTargetFields(targetDomain as ImportTargetDomain);
  }

  @RequirePermissions("imports.read")
  @Get("profiles")
  listProfiles(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListImportProfilesDto) {
    return this.importsService.listProfiles(auth.organizationId, query);
  }

  @RequirePermissions("imports.manage")
  @Post("profiles")
  createProfile(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateImportProfileDto) {
    return this.importsService.createProfile(auth, dto);
  }

  @RequirePermissions("imports.read")
  @Get("profiles/:profileId")
  getProfile(@CurrentAuth() auth: AuthenticatedUser, @Param("profileId") profileId: string) {
    return this.importsService.getProfile(auth.organizationId, profileId);
  }

  @RequirePermissions("imports.manage")
  @Patch("profiles/:profileId")
  updateProfile(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("profileId") profileId: string,
    @Body() dto: UpdateImportProfileDto
  ) {
    return this.importsService.updateProfile(auth, profileId, dto);
  }

  @RequirePermissions("imports.manage")
  @Post("profiles/:profileId/archive")
  archiveProfile(@CurrentAuth() auth: AuthenticatedUser, @Param("profileId") profileId: string) {
    return this.importsService.archiveProfile(auth, profileId);
  }

  @RequirePermissions("imports.read")
  @Get("jobs")
  listJobs(@CurrentAuth() auth: AuthenticatedUser, @Query() query: ListImportJobsDto) {
    return this.importsService.listJobs(auth.organizationId, query);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("ifc4/analyze")
  analyzeIfc4(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.ifc4AssistantService.analyze(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("ifc4/spatial/create-job")
  createIfc4SpatialJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.ifc4AssistantService.createSpatialJob(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("ifc4/asset-references/preview")
  previewIfc4AssetReferences(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.ifc4AssistantService.previewAssetReferences(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("ifc4/asset-references/apply")
  applyIfc4AssetReferences(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.ifc4AssistantService.applyAssetReferences(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("ifc4/equipments/create-job")
  createIfc4EquipmentsJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.ifc4AssistantService.createEquipmentsJob(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @Post("jobs")
  createJob(@CurrentAuth() auth: AuthenticatedUser, @Body() dto: CreateImportJobDto) {
    return this.importsService.createJob(auth, dto);
  }

  @RequirePermissions("imports.read")
  @Get("jobs/:jobId")
  getJob(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.getJob(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @Post("jobs/:jobId/upload")
  uploadJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() dto: UploadImportJobDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer }
  ) {
    return this.importsService.uploadJob(auth, jobId, dto, file);
  }

  @RequirePermissions("imports.execute")
  @Post("jobs/:jobId/preview")
  previewJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() dto: RunImportJobDto
  ) {
    return this.importsService.previewJob(auth, jobId, dto);
  }

  @RequirePermissions("imports.execute")
  @Post("jobs/:jobId/validate")
  validateJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() dto: RunImportJobDto
  ) {
    return this.importsService.validateJob(auth, jobId, dto);
  }

  @RequirePermissions("imports.execute")
  @Post("jobs/:jobId/execute")
  executeJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() dto: RunImportJobDto
  ) {
    return this.importsService.executeJob(auth, jobId, dto);
  }

  @RequirePermissions("imports.read")
  @Get("jobs/:jobId/report")
  getReport(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.getJobReport(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.manage")
  @Post("jobs/:jobId/cancel")
  cancelJob(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.cancelJob(auth, jobId);
  }

  @RequirePermissions("imports.manage")
  @Post("jobs/:jobId/purge-created-data")
  purgeCreatedData(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.purgeCreatedData(auth, jobId);
  }

  @RequirePermissions("imports.manage")
  @Delete("jobs/:jobId")
  deleteJob(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.deleteJob(auth, jobId);
  }
}
