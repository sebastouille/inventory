import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { EquipmentReconciliationResponse, LinkEquipmentImmobilizationInput, ReconciliationCandidate, UnlinkEquipmentImmobilizationInput } from "@inventory/shared";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getEquipment(organizationId: string, equipmentId: string): Promise<EquipmentReconciliationResponse> {
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId
      },
      include: {
        equipmentType: {
          include: {
            subfamily: {
              include: {
                family: true
              }
            }
          }
        },
        equipmentModel: true,
        currentSpatialNode: true,
        immobilization: true
      }
    });
    if (!equipment) {
      throw new NotFoundException("Equipement introuvable");
    }
    const immobilizations = await this.prisma.immobilization.findMany({
      where: {
        organizationId,
        isActive: true
      },
      orderBy: {
        code: "asc"
      }
    });
    const candidates = immobilizations
      .map((immobilization) => this.scoreCandidate(equipment, immobilization))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 20);

    return {
      equipmentId: equipment.id,
      internalCode: equipment.internalCode,
      label: equipment.equipmentModel?.label ?? equipment.equipmentType.label,
      numPiece: equipment.numPiece ?? null,
      externalRef: equipment.externalRef ?? null,
      currentImmobilizationId: equipment.immobilizationId ?? null,
      currentImmobilizationCode: equipment.immobilization?.code ?? null,
      currentImmobilizationLabel: equipment.immobilization?.label ?? null,
      candidates
    };
  }

  async link(auth: AuthenticatedUser, equipmentId: string, input: LinkEquipmentImmobilizationInput) {
    if (!input.immobilizationId) {
      throw new BadRequestException("Immobilisation obligatoire");
    }
    const [equipment, immobilization] = await Promise.all([
      this.prisma.equipment.findFirst({
        where: {
          id: equipmentId,
          organizationId: auth.organizationId
        }
      }),
      this.prisma.immobilization.findFirst({
        where: {
          id: input.immobilizationId,
          organizationId: auth.organizationId
        }
      })
    ]);
    if (!equipment) {
      throw new NotFoundException("Equipement introuvable");
    }
    if (!immobilization) {
      throw new NotFoundException("Immobilisation introuvable");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: {
          id: equipmentId
        },
        data: {
          immobilizationId: immobilization.id
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "reconciliation.equipment.linked",
        entityType: "equipment",
        entityId: equipmentId,
        metadata: {
          immobilizationId: immobilization.id,
          immobilizationCode: immobilization.code,
          reason: input.reason ?? null
        }
      });
    });
    return this.getEquipment(auth.organizationId, equipmentId);
  }

  async unlink(auth: AuthenticatedUser, equipmentId: string, input: UnlinkEquipmentImmobilizationInput) {
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId: auth.organizationId
      }
    });
    if (!equipment) {
      throw new NotFoundException("Equipement introuvable");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: {
          id: equipmentId
        },
        data: {
          immobilizationId: null
        }
      });
      await this.auditService.log({
        db: tx,
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "reconciliation.equipment.unlinked",
        entityType: "equipment",
        entityId: equipmentId,
        metadata: {
          previousImmobilizationId: equipment.immobilizationId,
          reason: input.reason ?? null
        }
      });
    });
    return this.getEquipment(auth.organizationId, equipmentId);
  }

  private scoreCandidate(
    equipment: {
      internalCode: string;
      numPiece: string | null;
      externalRef: string | null;
      equipmentType: { label: string; subfamily: { family: { label: string } } };
      equipmentModel: { label: string } | null;
    },
    immobilization: {
      id: string;
      code: string;
      label: string;
      status: string | null;
      externalRef: string | null;
    }
  ): ReconciliationCandidate {
    const reasons: string[] = [];
    let score = 0;
    const label = immobilization.label.toLocaleLowerCase("fr-FR");
    if (equipment.numPiece && label.includes(equipment.numPiece.toLocaleLowerCase("fr-FR"))) {
      score += 30;
      reasons.push("meme num_piece");
    }
    if (equipment.externalRef && immobilization.externalRef === equipment.externalRef) {
      score += 30;
      reasons.push("meme reference externe");
    }
    if (label.includes(equipment.equipmentType.label.toLocaleLowerCase("fr-FR"))) {
      score += 20;
      reasons.push("type proche");
    }
    if (label.includes(equipment.equipmentType.subfamily.family.label.toLocaleLowerCase("fr-FR"))) {
      score += 10;
      reasons.push("famille proche");
    }
    if (equipment.equipmentModel && label.includes(equipment.equipmentModel.label.toLocaleLowerCase("fr-FR"))) {
      score += 10;
      reasons.push("modele proche");
    }
    if (immobilization.code.includes(equipment.internalCode) || equipment.internalCode.includes(immobilization.code)) {
      score += 10;
      reasons.push("code proche");
    }
    return {
      immobilizationId: immobilization.id,
      code: immobilization.code,
      label: immobilization.label,
      status: immobilization.status,
      score,
      reasons
    };
  }
}
