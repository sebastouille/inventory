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
  Header,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { tmpdir } from "node:os";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "../swagger-compat";
import { IMPORT_TARGET_DOMAINS, type ImportTargetDomain } from "@inventory/shared";
import { CurrentAuth } from "../auth/current-auth.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtGuard } from "../auth/jwt.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CreateImportJobDto } from "./dto/create-import-job.dto";
import { CreateImportProfileDto } from "./dto/create-import-profile.dto";
import { Ifc4AssistantDto, Ifc4AssistantProfileDto } from "./dto/ifc4-assistant.dto";
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

  @RequirePermissions("imports.read")
  @Get("ifc4/profiles")
  listIfc4Profiles(@CurrentAuth() auth: AuthenticatedUser) {
    return this.ifc4AssistantService.listAssistantProfiles(auth.organizationId);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/profiles")
  createIfc4Profile(@CurrentAuth() auth: AuthenticatedUser, @Body() body: Ifc4AssistantProfileDto) {
    return this.ifc4AssistantService.createAssistantProfile(auth, body);
  }

  @RequirePermissions("imports.read")
  @Get("ifc4/profiles/:profileId")
  getIfc4Profile(@CurrentAuth() auth: AuthenticatedUser, @Param("profileId") profileId: string) {
    return this.ifc4AssistantService.getAssistantProfile(auth.organizationId, profileId);
  }

  @RequirePermissions("imports.manage")
  @Patch("ifc4/profiles/:profileId")
  updateIfc4Profile(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("profileId") profileId: string,
    @Body() body: Ifc4AssistantProfileDto
  ) {
    return this.ifc4AssistantService.updateAssistantProfile(auth, profileId, body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/profiles/:profileId/archive")
  archiveIfc4Profile(@CurrentAuth() auth: AuthenticatedUser, @Param("profileId") profileId: string) {
    return this.ifc4AssistantService.archiveAssistantProfile(auth, profileId);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { dest: tmpdir() }))
  @Post("ifc4/analyze-jobs/quick-parse")
  quickParseIfc4AnalysisJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer?: Buffer; path?: string; size?: number }
  ) {
    return this.ifc4AssistantService.quickParseAnalysisJob(auth, file, body);
  }

  @RequirePermissions("imports.manage")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { dest: tmpdir() }))
  @Post("ifc4/analyze-jobs")
  createIfc4AnalysisJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Body() body: Ifc4AssistantDto,
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer?: Buffer; path?: string; size?: number }
  ) {
    return this.ifc4AssistantService.createAnalysisJob(auth, file, body);
  }

  @RequirePermissions("imports.read")
  @Get("ifc4/analyze-jobs/:jobId/quick-result")
  getIfc4QuickParseResult(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.getQuickParseResult(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/start")
  startIfc4AnalysisJob(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() body: Ifc4AssistantDto
  ) {
    return this.ifc4AssistantService.startAnalysisJob(auth, jobId, body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/cancel")
  cancelIfc4AnalysisJob(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.cancelAnalysisJob(auth, jobId);
  }

  @RequirePermissions("imports.read")
  @Get("ifc4/analyze-jobs/:jobId/result")
  getIfc4AnalysisJobResult(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.getAnalysisResult(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.read")
  @Get("ifc4/analyze-jobs/:jobId/geometry-diagnostics")
  getIfc4GeometryDiagnostics(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.getGeometryDiagnostics(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.read")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=\"ifc4-geometry-diagnostics.csv\"")
  @Get("ifc4/analyze-jobs/:jobId/geometry-diagnostics/export")
  exportIfc4GeometryDiagnostics(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.exportGeometryDiagnosticsCsv(auth.organizationId, jobId);
  }

  @RequirePermissions("imports.read")
  @Get("ifc4/analyze-jobs/:jobId/workflow")
  getIfc4Workflow(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.getWorkflow(auth, jobId);
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/spatial/preview")
  previewIfc4Spatial(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "spatial", "preview", body);
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/spatial/validate")
  validateIfc4Spatial(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "spatial", "validate", body);
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/spatial/execute")
  executeIfc4Spatial(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "spatial", "execute", body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/spatial/cancel")
  cancelIfc4Spatial(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "spatial", "cancel");
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/equipments/preview")
  previewIfc4Equipments(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "equipments", "preview", body);
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/equipments/validate")
  validateIfc4Equipments(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "equipments", "validate", body);
  }

  @RequirePermissions("imports.execute")
  @Post("ifc4/analyze-jobs/:jobId/equipments/execute")
  executeIfc4Equipments(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string, @Body() body: Ifc4AssistantDto) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "equipments", "execute", body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/equipments/cancel")
  cancelIfc4Equipments(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.ifc4AssistantService.runWorkflowChildAction(auth, jobId, "equipments", "cancel");
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/spatial/create-job")
  createIfc4SpatialJobFromAnalysis(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() body: Ifc4AssistantDto
  ) {
    return this.ifc4AssistantService.createSpatialJobFromAnalysis(auth, jobId, body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/equipments/create-job")
  createIfc4EquipmentsJobFromAnalysis(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() body: Ifc4AssistantDto
  ) {
    return this.ifc4AssistantService.createEquipmentsJobFromAnalysis(auth, jobId, body);
  }

  @RequirePermissions("imports.manage")
  @Post("ifc4/analyze-jobs/:jobId/asset-references/apply")
  applyIfc4AssetReferencesFromAnalysis(
    @CurrentAuth() auth: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() body: Ifc4AssistantDto
  ) {
    return this.ifc4AssistantService.applyAssetReferencesFromAnalysis(auth, jobId, body);
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

  @RequirePermissions("imports.read")
  @Get("jobs/:jobId/logs")
  getJobLogs(@CurrentAuth() auth: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.importsService.listJobLogs(auth.organizationId, jobId);
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
