import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  EquipmentLabelPreviewItem,
  LabelExportEquipmentQuery,
  LabelExportFormat,
  LabelExportPreviewResponse,
  LabelExportSpatialNodeQuery,
  SpatialNodeLabelPreviewItem
} from "@inventory/shared";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma.service";

type ExportResult = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

type EquipmentForLabel = Prisma.EquipmentGetPayload<{
  include: {
    equipmentType: {
      include: {
        subfamily: {
          include: {
            family: {
              include: {
                category: true;
              };
            };
          };
        };
      };
    };
    equipmentModel: {
      include: {
        brand: true;
      };
    };
    equipmentStatus: true;
    ownerEntity: true;
    currentSpatialNode: true;
    immobilization: true;
  };
}>;

type SpatialNodeForLabel = Prisma.SpatialNodeGetPayload<Record<string, never>>;

const EXCLUDED_STATUS_CODES = new Set(["LOST", "PERDU", "SCRAPPED", "REBUT", "RETIRED", "ARCHIVED"]);
const ROOM_NUMBER_PROPERTY_KEYS = [
  "N\u00b0 de pi\u00e8ce",
  "N\u00b0 de piece",
  "No de piece",
  "Numero de piece",
  "Numero piece",
  "Room number"
];

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

@Injectable()
export class LabelExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async previewEquipments(
    organizationId: string,
    input: LabelExportEquipmentQuery
  ): Promise<LabelExportPreviewResponse<EquipmentLabelPreviewItem>> {
    const equipments = await this.getEquipmentCandidates(organizationId, input);
    const items = equipments.map((equipment) => this.mapEquipmentLabel(equipment));
    return {
      total: items.length,
      items
    };
  }

  async exportEquipments(organizationId: string, input: LabelExportEquipmentQuery): Promise<ExportResult> {
    const preview = await this.previewEquipments(organizationId, input);
    return this.buildExport("etiquettes-equipements", input.format, preview.items.map((item) => ({
      Famille: item.family,
      CodeInterne: item.internalCode,
      PayloadCodeBarres: item.barcodePayload,
      Categorie: item.category,
      SousFamille: item.subfamily,
      Type: item.type,
      Marque: item.brand,
      Modele: item.model,
      NumeroSerie: item.serialNumber,
      NumPiece: item.numPiece,
      ReferenceExterne: item.externalRef,
      Localisation: item.currentSpatialNodeLabel,
      CheminSpatial: item.currentSpatialPath,
      Proprietaire: item.ownerEntity,
      Statut: item.status,
      Immobilisation: item.immobilizationCode
    })), preview.items.map((item) => ({
      title: `${item.family} ${item.internalCode}`.trim(),
      subtitle: item.currentSpatialNodeLabel ?? item.currentSpatialPath ?? "",
      payload: item.barcodePayload
    })));
  }

  async previewSpatialNodes(
    organizationId: string,
    input: LabelExportSpatialNodeQuery
  ): Promise<LabelExportPreviewResponse<SpatialNodeLabelPreviewItem>> {
    const nodes = await this.getSpatialNodeCandidates(organizationId, input);
    const items = nodes.map((node) => this.mapSpatialNodeLabel(node));
    return {
      total: items.length,
      items
    };
  }

  async exportSpatialNodes(organizationId: string, input: LabelExportSpatialNodeQuery): Promise<ExportResult> {
    const preview = await this.previewSpatialNodes(organizationId, input);
    return this.buildExport("etiquettes-noeuds", input.format, preview.items.map((item) => ({
      path: item.spatialPath,
      "N\u00b0 de pi\u00e8ce": item.roomNumber,
      node: item.barcodePayload,
      type: item.nodeType
    })), preview.items.map((item) => ({
      title: `${item.nodeType} ${item.nodeLabel}`.trim(),
      subtitle: item.spatialPath,
      payload: item.barcodePayload
    })));
  }

  private async getEquipmentCandidates(organizationId: string, input: LabelExportEquipmentQuery) {
    const selectedSpatialIds = input.selectedSpatialNodeIds ?? [];
    const spatialPaths = await this.resolveSpatialPaths(organizationId, selectedSpatialIds);
    const manualIds = input.manualEquipmentIds ?? [];
    const equipments = await this.prisma.equipment.findMany({
      where: {
        organizationId,
        isDeleted: false,
        internalCode: {
          not: ""
        }
      },
      include: {
        equipmentType: {
          include: {
            subfamily: {
              include: {
                family: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        },
        equipmentModel: {
          include: {
            brand: true
          }
        },
        equipmentStatus: true,
        ownerEntity: true,
        currentSpatialNode: true,
        immobilization: true
      },
      orderBy: {
        internalCode: "asc"
      }
    });

    const q = input.q?.trim().toLocaleLowerCase("fr-FR") ?? "";
    return equipments.filter((equipment) => {
      if (EXCLUDED_STATUS_CODES.has(equipment.equipmentStatus.code.toUpperCase())) {
        return false;
      }
      if (input.categoryIds?.length && !input.categoryIds.includes(equipment.equipmentType.subfamily.family.category.id)) {
        return false;
      }
      if (input.familyIds?.length && !input.familyIds.includes(equipment.equipmentType.subfamily.family.id)) {
        return false;
      }
      if (input.subfamilyIds?.length && !input.subfamilyIds.includes(equipment.equipmentType.subfamily.id)) {
        return false;
      }
      if (input.typeIds?.length && !input.typeIds.includes(equipment.equipmentType.id)) {
        return false;
      }
      if (input.statusIds?.length && !input.statusIds.includes(equipment.equipmentStatus.id)) {
        return false;
      }
      if (input.ownerEntityIds?.length && !input.ownerEntityIds.includes(equipment.ownerEntity.id)) {
        return false;
      }
      if (input.hasImmobilization === true && !equipment.immobilizationId) {
        return false;
      }
      if (input.hasImmobilization === false && equipment.immobilizationId) {
        return false;
      }
      if (spatialPaths.length > 0 && !manualIds.includes(equipment.id)) {
        const equipmentPath = equipment.currentSpatialNode?.path ?? null;
        if (!equipmentPath) {
          return false;
        }
        const matchesSpatial = spatialPaths.some((path) =>
          input.includeChildren ? equipmentPath === path || equipmentPath.startsWith(`${path}/`) : equipmentPath === path
        );
        if (!matchesSpatial) {
          return false;
        }
      }
      if (manualIds.includes(equipment.id)) {
        return true;
      }
      if (!q) {
        return true;
      }
      return [
        equipment.internalCode,
        equipment.numPiece,
        equipment.externalRef,
        equipment.serialNumber,
        equipment.equipmentType.label,
        equipment.equipmentType.subfamily.label,
        equipment.equipmentType.subfamily.family.label,
        equipment.equipmentModel?.label,
        equipment.currentSpatialNode?.label,
        equipment.currentSpatialNode?.path,
        equipment.immobilization?.code
      ].some((value) => value?.toLocaleLowerCase("fr-FR").includes(q));
    });
  }

  private async getSpatialNodeCandidates(organizationId: string, input: LabelExportSpatialNodeQuery) {
    const selectedPaths = await this.resolveSpatialPaths(organizationId, input.selectedSpatialNodeIds ?? []);
    const nodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        isActive: true
      },
      orderBy: [{ path: "asc" }]
    });
    return nodes.filter((node) => {
      if (input.nodeTypes?.length && !input.nodeTypes.includes(node.type)) {
        return false;
      }
      if (selectedPaths.length === 0) {
        return true;
      }
      return selectedPaths.some((path) =>
        input.includeChildren ? node.path === path || node.path.startsWith(`${path}/`) : node.path === path
      );
    });
  }

  private async resolveSpatialPaths(organizationId: string, spatialNodeIds: string[]) {
    if (spatialNodeIds.length === 0) {
      return [];
    }
    const nodes = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        id: {
          in: spatialNodeIds
        }
      },
      select: {
        path: true
      }
    });
    return nodes.map((node) => node.path);
  }

  private mapEquipmentLabel(equipment: EquipmentForLabel): EquipmentLabelPreviewItem {
    return {
      id: equipment.id,
      family: equipment.equipmentType.subfamily.family.label,
      internalCode: equipment.internalCode,
      barcodePayload: `EQ:${equipment.internalCode}`,
      category: equipment.equipmentType.subfamily.family.category.label,
      subfamily: equipment.equipmentType.subfamily.label,
      type: equipment.equipmentType.label,
      brand: equipment.equipmentModel?.brand.label ?? null,
      model: equipment.equipmentModel?.label ?? null,
      serialNumber: equipment.serialNumber ?? null,
      numPiece: equipment.numPiece ?? null,
      externalRef: equipment.externalRef ?? null,
      currentSpatialNodeLabel: equipment.currentSpatialNode?.label ?? null,
      currentSpatialPath: equipment.currentSpatialNode?.path ?? null,
      ownerEntity: equipment.ownerEntity.label,
      status: equipment.equipmentStatus.label,
      immobilizationCode: equipment.immobilization?.code ?? null
    };
  }

  private mapSpatialNodeLabel(node: SpatialNodeForLabel): SpatialNodeLabelPreviewItem {
    return {
      id: node.id,
      nodeType: node.type,
      nodeCode: node.code,
      nodeLabel: node.label,
      spatialPath: node.path,
      roomNumber: node.type === "ROOM" ? this.readSpatialNodeProperty(node.sourceMetadata, ROOM_NUMBER_PROPERTY_KEYS) : null,
      barcodePayload: `NODE:${node.id}`
    };
  }

  private readSpatialNodeProperty(sourceMetadata: Prisma.JsonValue, candidates: string[]) {
    if (!sourceMetadata || typeof sourceMetadata !== "object" || Array.isArray(sourceMetadata)) {
      return null;
    }

    const properties = (sourceMetadata as Record<string, unknown>).properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      return null;
    }

    const normalizedCandidates = candidates.map((candidate) => candidate.toLocaleLowerCase("fr-FR"));
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (!normalizedCandidates.includes(key.toLocaleLowerCase("fr-FR"))) {
        continue;
      }
      if (typeof value === "string") {
        return value.trim() || null;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }

    return null;
  }

  private buildExport(
    basename: string,
    format: LabelExportFormat | undefined,
    rows: Record<string, string | number | boolean | null>[],
    labels: Array<{ title: string; subtitle: string; payload: string }>
  ): ExportResult {
    const resolvedFormat = format ?? "xlsx";
    if (resolvedFormat === "pdf-a4") {
      return {
        buffer: this.buildPdf(labels),
        filename: `${basename}.pdf`,
        contentType: "application/pdf"
      };
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Etiquettes");
    const output = XLSX.write(workbook, {
      type: "buffer",
      bookType: resolvedFormat === "ods" ? "ods" : "xlsx",
      compression: true
    }) as Uint8Array;

    return {
      buffer: Buffer.from(output),
      filename: `${basename}.${resolvedFormat}`,
      contentType:
        resolvedFormat === "ods"
          ? "application/vnd.oasis.opendocument.spreadsheet"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
  }

  private buildPdf(labels: Array<{ title: string; subtitle: string; payload: string }>) {
    const pages: string[] = [];
    const labelsPerPage = 24;
    const pageWidth = 595;
    const pageHeight = 842;
    const marginX = 28;
    const marginY = 34;
    const cellWidth = 176;
    const cellHeight = 96;

    for (let pageIndex = 0; pageIndex < Math.max(1, Math.ceil(labels.length / labelsPerPage)); pageIndex += 1) {
      const pageLabels = labels.slice(pageIndex * labelsPerPage, (pageIndex + 1) * labelsPerPage);
      const commands: string[] = ["q", "0.5 w"];
      pageLabels.forEach((label, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = marginX + column * cellWidth;
        const y = pageHeight - marginY - (row + 1) * cellHeight;
        commands.push(`${x} ${y} ${cellWidth - 8} ${cellHeight - 8} re S`);
        commands.push(this.pdfText(x + 8, y + cellHeight - 24, 9, label.title.slice(0, 34)));
        commands.push(this.pdfText(x + 8, y + cellHeight - 39, 7, label.subtitle.slice(0, 42)));
        commands.push(...this.pdfBarcodeCommands(label.payload, x + 8, y + 24, 0.72, 28));
        commands.push(this.pdfText(x + 8, y + 11, 7, label.payload.slice(0, 44)));
      });
      commands.push("Q");
      pages.push(commands.join("\n"));
    }

    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(`<< /Type /Pages /Kids [${pages.map((_page, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
    pages.forEach((content, index) => {
      const pageObjectId = 3 + index * 2;
      const contentObjectId = pageObjectId + 1;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectId} 0 R >>`);
      objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  private pdfText(x: number, y: number, size: number, text: string) {
    return `BT /F1 ${size} Tf ${x} ${y} Td (${this.escapePdfText(text)}) Tj ET`;
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  private pdfBarcodeCommands(payload: string, x: number, y: number, moduleWidth: number, height: number) {
    const codes = this.code128Codes(payload);
    const commands: string[] = ["0 g"];
    let cursor = x;
    codes.forEach((code) => {
      const pattern = CODE128_PATTERNS[code] ?? "";
      pattern.split("").forEach((widthChar, index) => {
        const width = Number(widthChar) * moduleWidth;
        if (index % 2 === 0) {
          commands.push(`${cursor.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
        }
        cursor += width;
      });
    });
    return commands;
  }

  private code128Codes(payload: string) {
    const sanitized = payload.replace(/[^\x20-\x7E]/g, "?");
    const codes = [104];
    for (const char of sanitized) {
      codes.push(char.charCodeAt(0) - 32);
    }
    const checksum = codes.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
    return [...codes, checksum, 106];
  }
}
