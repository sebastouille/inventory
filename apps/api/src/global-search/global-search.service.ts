import { Injectable } from "@nestjs/common";
import type { GlobalSearchDomain, GlobalSearchGroup, GlobalSearchItem, GlobalSearchResponse, IamPermissionCode } from "@inventory/shared";
import { GLOBAL_SEARCH_DOMAIN_LABELS } from "@inventory/shared";
import type { ImportJobStatus, ImportSourceKind, ImportTargetDomain } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";

type SearchCandidate = {
  domain: GlobalSearchDomain;
  item: GlobalSearchItem;
  score: number;
  updatedAt: string;
};

const MIN_QUERY_LENGTH = 3;
const MAX_GROUP_ITEMS = 5;
const MAX_TOTAL_ITEMS = 20;
const MAX_FETCH_ITEMS = 40;
const DOMAIN_ORDER: GlobalSearchDomain[] = [
  "assets",
  "campaigns",
  "locations",
  "immobilizations",
  "imports.jobs",
  "imports.profiles"
];

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function keywordScore(query: string, keywords: string[]) {
  let best = 0;
  for (const keyword of keywords) {
    const normalized = normalizeSearchValue(keyword);
    if (!normalized) {
      continue;
    }
    if (normalized === query) {
      best = Math.max(best, 260);
      continue;
    }
    if (normalized.startsWith(query)) {
      best = Math.max(best, 220);
      continue;
    }
    if (normalized.includes(query)) {
      best = Math.max(best, 180);
    }
  }
  return best;
}

function textScore(query: string, values: Array<string | null | undefined>, baseScore: number) {
  let best = 0;
  for (const rawValue of values) {
    const normalized = normalizeSearchValue(rawValue ?? "");
    if (!normalized) {
      continue;
    }
    if (normalized === query) {
      best = Math.max(best, baseScore + 160);
      continue;
    }
    const token = normalized.split(/[\s\-_/]+/).find((part) => part.startsWith(query));
    if (token) {
      best = Math.max(best, baseScore + 110);
    }
    if (normalized.startsWith(query)) {
      best = Math.max(best, baseScore + 130);
      continue;
    }
    const index = normalized.indexOf(query);
    if (index >= 0) {
      best = Math.max(best, baseScore + Math.max(20, 90 - index));
    }
  }
  return best;
}

function compareCandidates(left: SearchCandidate, right: SearchCandidate) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}

function groupCandidates(candidates: SearchCandidate[]): GlobalSearchGroup[] {
  const perGroup = new Map<GlobalSearchDomain, SearchCandidate[]>();
  for (const domain of DOMAIN_ORDER) {
    perGroup.set(domain, []);
  }

  for (const candidate of candidates) {
    const current = perGroup.get(candidate.domain) ?? [];
    current.push(candidate);
    perGroup.set(candidate.domain, current);
  }

  const limitedPerGroup = DOMAIN_ORDER.flatMap((domain) =>
    (perGroup.get(domain) ?? []).sort(compareCandidates).slice(0, MAX_GROUP_ITEMS)
  );
  const keptKeys = new Set(
    limitedPerGroup
      .sort(compareCandidates)
      .slice(0, MAX_TOTAL_ITEMS)
      .map((candidate) => `${candidate.domain}:${candidate.item.id}`)
  );

  return DOMAIN_ORDER.map((domain) => {
    const items = (perGroup.get(domain) ?? [])
      .sort(compareCandidates)
      .filter((candidate) => keptKeys.has(`${candidate.domain}:${candidate.item.id}`))
      .map((candidate) => candidate.item);

    return {
      domain,
      label: GLOBAL_SEARCH_DOMAIN_LABELS[domain],
      items
    };
  }).filter((group) => group.items.length > 0);
}

function hasAnyPermission(userPermissions: IamPermissionCode[], required: IamPermissionCode[]) {
  return required.some((permission) => userPermissions.includes(permission));
}

function compactText(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

@Injectable()
export class GlobalSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(auth: AuthenticatedUser, rawQuery: string): Promise<GlobalSearchResponse> {
    const query = normalizeSearchValue(rawQuery);
    if (query.length < MIN_QUERY_LENGTH) {
      return {
        query: rawQuery.trim(),
        total: 0,
        groups: []
      };
    }

    const domainResults = await Promise.all([
      hasAnyPermission(auth.permissions, ["assets.read"]) ? this.searchAssets(auth.organizationId, query) : [],
      hasAnyPermission(auth.permissions, ["campaigns.read"]) ? this.searchCampaigns(auth.organizationId, query) : [],
      hasAnyPermission(auth.permissions, ["spatial.read"]) ? this.searchLocations(auth.organizationId, query) : [],
      hasAnyPermission(auth.permissions, ["assets.read"]) ? this.searchImmobilizations(auth.organizationId, query) : [],
      hasAnyPermission(auth.permissions, ["imports.read"]) ? this.searchImportJobs(auth.organizationId, query) : [],
      hasAnyPermission(auth.permissions, ["imports.read"]) ? this.searchImportProfiles(auth.organizationId, query) : []
    ]);

    const groups = groupCandidates(domainResults.flat());
    return {
      query: rawQuery.trim(),
      total: groups.reduce((total, group) => total + group.items.length, 0),
      groups
    };
  }

  private shouldUseKeywordFallback(query: string, keywords: string[]) {
    return keywordScore(query, keywords) > 0;
  }

  private async searchAssets(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["equipement", "equipements", "asset", "assets", "bien", "biens"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.equipment.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [
                { internalCode: { contains: query, mode: "insensitive" } },
                { numPiece: { contains: query, mode: "insensitive" } },
                { externalRef: { contains: query, mode: "insensitive" } },
                { equipmentType: { is: { label: { contains: query, mode: "insensitive" } } } },
                { equipmentModel: { is: { label: { contains: query, mode: "insensitive" } } } },
                { currentSpatialNode: { is: { label: { contains: query, mode: "insensitive" } } } },
                { immobilization: { is: { code: { contains: query, mode: "insensitive" } } } },
                { immobilization: { is: { label: { contains: query, mode: "insensitive" } } } }
              ]
            })
      },
      include: {
        equipmentType: true,
        equipmentModel: true,
        currentSpatialNode: true,
        immobilization: true
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.internalCode, row.numPiece, row.externalRef], 700),
        textScore(
          query,
          [row.equipmentType.label, row.equipmentModel?.label, row.currentSpatialNode?.label, row.immobilization?.label],
          480
        ),
        textScore(query, [row.immobilization?.code], 560)
      );

      if (score <= 0) {
        continue;
      }

      const title = row.equipmentModel?.label ?? row.equipmentType.label ?? row.internalCode;
      const subtitleParts = compactText([
        row.equipmentType.label,
        row.currentSpatialNode?.label ?? row.currentSpatialNode?.path ?? null,
        row.immobilization?.code ? `Immo ${row.immobilization.code}` : null,
        row.isDeleted ? "Archive" : null
      ]);

      candidates.push({
        domain: "assets",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "assets",
          title,
          code: row.internalCode,
          subtitle: subtitleParts.join(" - ") || null,
          href: `/assets/${row.id}`
        }
      });
    }

    return candidates;
  }

  private async searchCampaigns(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["campagne", "campagnes", "inventaire", "inventaires"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.inventoryCampaign.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } }
              ]
            })
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.name], 720),
        textScore(query, [row.description], 420)
      );

      if (score <= 0) {
        continue;
      }

      candidates.push({
        domain: "campaigns",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "campaigns",
          title: row.name,
          code: null,
          subtitle: compactText([row.status, row.description]).join(" - ") || null,
          href: `/campaigns?campaignId=${row.id}`
        }
      });
    }

    return candidates;
  }

  private async searchLocations(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["localisation", "localisations", "site", "sites", "batiment", "batiments", "zone", "zones", "piece", "pieces"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.spatialNode.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { label: { contains: query, mode: "insensitive" } },
                { path: { contains: query, mode: "insensitive" } },
                { externalRef: { contains: query, mode: "insensitive" } }
              ]
            })
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.code], 700),
        textScore(query, [row.label], 620),
        textScore(query, [row.path, row.externalRef], 420)
      );

      if (score <= 0) {
        continue;
      }

      candidates.push({
        domain: "locations",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "locations",
          title: row.label,
          code: row.code,
          subtitle: compactText([row.type, row.path, row.isActive ? null : "Inactif"]).join(" - ") || null,
          href: `/locations?perimeterId=${row.id}`
        }
      });
    }

    return candidates;
  }

  private async searchImmobilizations(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["immobilisation", "immobilisations", "immo", "comptabilite"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.immobilization.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { label: { contains: query, mode: "insensitive" } },
                { externalRef: { contains: query, mode: "insensitive" } },
                { costCenter: { contains: query, mode: "insensitive" } }
              ]
            })
      },
      include: {
        _count: {
          select: {
            equipments: true
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.code], 720),
        textScore(query, [row.label], 620),
        textScore(query, [row.externalRef, row.costCenter], 420)
      );

      if (score <= 0) {
        continue;
      }

      const subtitleParts = compactText([
        row.status,
        row.costCenter ? `Centre ${row.costCenter}` : null,
        `${row._count.equipments} equip.`,
        row.isActive ? null : "Archivee"
      ]);

      candidates.push({
        domain: "immobilizations",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "immobilizations",
          title: row.label,
          code: row.code,
          subtitle: subtitleParts.join(" - ") || null,
          href: `/immobilizations?immobilizationId=${row.id}`
        }
      });
    }

    return candidates;
  }

  private async searchImportJobs(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["import", "imports", "job", "jobs", "csv", "xlsx", "ifc"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.importJob.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [{ originalFilename: { contains: query, mode: "insensitive" } }]
            })
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const targetDomain = row.targetDomain as ImportTargetDomain;
      const sourceKind = row.sourceKind as ImportSourceKind | null;
      const status = row.status as ImportJobStatus;
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.originalFilename], 700),
        textScore(query, [targetDomain, sourceKind, status], 460)
      );

      if (score <= 0) {
        continue;
      }

      candidates.push({
        domain: "imports.jobs",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "imports.jobs",
          title: row.originalFilename ?? `Job ${targetDomain}`,
          code: null,
          subtitle: compactText([targetDomain, sourceKind, status]).join(" - ") || null,
          href: `/imports?jobId=${row.id}`
        }
      });
    }

    return candidates;
  }

  private async searchImportProfiles(organizationId: string, query: string): Promise<SearchCandidate[]> {
    const keywords = ["import", "imports", "profil", "profils", "csv", "xlsx"];
    const useKeywordFallback = this.shouldUseKeywordFallback(query, keywords);
    const rows = await this.prisma.importProfile.findMany({
      where: {
        organizationId,
        ...(useKeywordFallback
          ? {}
          : {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { sheetName: { contains: query, mode: "insensitive" } }
              ]
            })
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_FETCH_ITEMS
    });

    const candidates: SearchCandidate[] = [];

    for (const row of rows) {
      const targetDomain = row.targetDomain as ImportTargetDomain;
      const sourceKind = row.sourceKind as ImportSourceKind;
      const score = Math.max(
        keywordScore(query, keywords),
        textScore(query, [row.name], 700),
        textScore(query, [targetDomain, sourceKind, row.sheetName], 460)
      );

      if (score <= 0) {
        continue;
      }

      candidates.push({
        domain: "imports.profiles",
        score,
        updatedAt: row.updatedAt.toISOString(),
        item: {
          id: row.id,
          domain: "imports.profiles",
          title: row.name,
          code: null,
          subtitle: compactText([targetDomain, sourceKind, row.isArchived ? "Archive" : null]).join(" - ") || null,
          href: `/imports?profileId=${row.id}`
        }
      });
    }

    return candidates;
  }
}
