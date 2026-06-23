import {
  Injectable
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  OrganizationCurrentResponse,
  UpdateOrganizationSettingsInput,
  UpdateOrganizationSpatialDisplayInput
} from "@inventory/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma.service";
import {
  normalizeOrganizationSettings,
  validateOrganizationSettings,
  validateSpatialDisplay
} from "./organization-settings";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async current(organizationId: string): Promise<OrganizationCurrentResponse> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId }
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      settings: this.normalizeSettings(organization.settings)
    };
  }

  async updateSettings(
    auth: AuthenticatedUser,
    dto: UpdateOrganizationSettingsInput
  ): Promise<OrganizationCurrentResponse> {
    const settings = validateOrganizationSettings(dto);

    const organization = await this.prisma.organization.update({
      where: { id: auth.organizationId },
      data: { settings: settings as unknown as Prisma.InputJsonObject }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "organization.settings.update",
      entityType: "Organization",
      entityId: auth.organizationId,
      metadata: settings as unknown as Prisma.InputJsonObject
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      settings: this.normalizeSettings(organization.settings)
    };
  }

  async updateSpatialDisplay(
    auth: AuthenticatedUser,
    dto: UpdateOrganizationSpatialDisplayInput
  ): Promise<OrganizationCurrentResponse> {
    const spatialDisplay = validateSpatialDisplay(dto.spatialDisplay);
    const settings = {
      ...(await this.current(auth.organizationId)).settings,
      spatialDisplay
    };

    const organization = await this.prisma.organization.update({
      where: { id: auth.organizationId },
      data: { settings: settings as unknown as Prisma.InputJsonObject }
    });

    await this.auditService.log({
      organizationId: auth.organizationId,
      userId: auth.sub,
      action: "organization.spatial-display.update",
      entityType: "Organization",
      entityId: auth.organizationId,
      metadata: settings as unknown as Prisma.InputJsonObject
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      settings: this.normalizeSettings(organization.settings)
    };
  }

  private normalizeSettings(raw: unknown) {
    return normalizeOrganizationSettings(raw);
  }
}
