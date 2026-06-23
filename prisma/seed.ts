import {
  PrismaClient,
  IamAccessScopeType,
  Prisma,
  SpatialNodeType,
  SpatialSourceKind
} from "@prisma/client";
import { createHash } from "node:crypto";
import { buildDefaultOrganizationSettings } from "../packages/shared/src/organizations";

const prisma = new PrismaClient();

const IAM_ROLE_CODES = [
  "ADMINISTRATOR",
  "ASSET_MANAGER",
  "INVENTORY_AGENT",
  "ACCOUNTING",
  "LOGISTICS",
  "EXTERNAL_PROVIDER",
  "CAMPAIGN_SUPERVISOR"
] as const;

type IamRoleCode = (typeof IAM_ROLE_CODES)[number];

const IAM_PERMISSION_CODES = [
  "iam.users.read",
  "iam.users.create",
  "iam.users.update",
  "iam.roles.read",
  "iam.permissions.read",
  "iam.scopes.read",
  "organizations.read",
  "organizations.update",
  "inventory.overview.read",
  "locations.read",
  "products.read",
  "suppliers.read",
  "assets.read",
  "assets.create",
  "assets.update",
  "assets.archive",
  "assets.history.read",
  "asset-references.read",
  "asset-references.manage",
  "spatial.read",
  "spatial.manage",
  "labels.read",
  "labels.export",
  "movements.read",
  "movements.create",
  "campaigns.read",
  "campaigns.create",
  "campaigns.update",
  "campaigns.execute",
  "campaigns.review",
  "campaigns.archive",
  "anomalies.read",
  "anomalies.update",
  "imports.read",
  "imports.manage",
  "imports.execute",
  "integrations.archicad.read",
  "integrations.sap.read",
  "reconciliation.read",
  "reconciliation.manage",
  "bim3d.read",
  "bim3d.build",
  "bim3d.manage",
  "audit.read"
] as const;

type IamPermissionCode = (typeof IAM_PERMISSION_CODES)[number];

function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeSpatialCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .trim();
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function upsertSpatialNode(input: {
  organizationId: string;
  type: SpatialNodeType;
  code: string;
  label: string;
  description?: string | null;
  parentId?: string | null;
  legacyLocationId?: string | null;
  externalSource?: SpatialSourceKind | null;
  externalRef?: string | null;
}) {
  const normalizedCode = normalizeSpatialCode(input.code);
  const parentPath = input.parentId
    ? (
        await prisma.spatialNode.findUnique({
          where: { id: input.parentId },
          select: { path: true }
        })
      )?.path ?? null
    : null;
  const path = parentPath ? `${parentPath}/${normalizedCode}` : normalizedCode;
  const depth = path.split("/").length - 1;

  const existing = input.legacyLocationId
    ? await prisma.spatialNode.findFirst({
        where: {
          legacyLocationId: input.legacyLocationId
        }
      })
    : await prisma.spatialNode.findFirst({
        where: {
          organizationId: input.organizationId,
          path
        }
      });

  if (existing) {
    return prisma.spatialNode.update({
      where: { id: existing.id },
      data: {
        organizationId: input.organizationId,
        type: input.type,
        code: normalizedCode,
        label: input.label,
        description: input.description ?? null,
        path,
        depth,
        parentId: input.parentId ?? null,
        legacyLocationId: input.legacyLocationId ?? existing.legacyLocationId,
        externalSource: input.externalSource ?? null,
        externalRef: input.externalRef ?? null,
        isActive: true
      }
    });
  }

  return prisma.spatialNode.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      code: normalizedCode,
      label: input.label,
      description: input.description ?? null,
      path,
      depth,
      sortOrder: 0,
      parentId: input.parentId ?? null,
      legacyLocationId: input.legacyLocationId ?? null,
      externalSource: input.externalSource ?? null,
      externalRef: input.externalRef ?? null,
      isActive: true
    }
  });
}

async function upsertScopeFromSpatialNode(input: {
  organizationId: string;
  nodeId: string;
  type: IamAccessScopeType;
  code: string;
  label: string;
  parentScopeId?: string | null;
  externalRef?: string | null;
}) {
  return prisma.iamAccessScope.upsert({
    where: {
      organizationId_type_code: {
        organizationId: input.organizationId,
        type: input.type,
        code: input.code
      }
    },
    update: {
      label: input.label,
      parentScopeId: input.parentScopeId ?? null,
      spatialNodeId: input.nodeId,
      externalRef: input.externalRef ?? null,
      isActive: true
    },
    create: {
      organizationId: input.organizationId,
      type: input.type,
      code: input.code,
      label: input.label,
      parentScopeId: input.parentScopeId ?? null,
      spatialNodeId: input.nodeId,
      externalRef: input.externalRef ?? null,
      isActive: true
    }
  });
}

const roleCatalog: Record<IamRoleCode, { label: string; description: string }> = {
  ADMINISTRATOR: {
    label: "Administrateur",
    description: "Administration de la plateforme, des habilitations et de la configuration."
  },
  ASSET_MANAGER: {
    label: "Gestionnaire patrimoine",
    description: "Pilotage des biens, des localisations et du suivi patrimonial."
  },
  INVENTORY_AGENT: {
    label: "Agent inventaire",
    description: "Execution des inventaires terrain et des constats sur site."
  },
  ACCOUNTING: {
    label: "Comptabilite",
    description: "Consultation des donnees necessaires au rapprochement comptable."
  },
  LOGISTICS: {
    label: "Logistique",
    description: "Gestion des flux physiques, des mouvements et des stocks."
  },
  EXTERNAL_PROVIDER: {
    label: "Prestataire externe",
    description: "Intervention encadree sur un perimetre attribue."
  },
  CAMPAIGN_SUPERVISOR: {
    label: "Superviseur campagne",
    description: "Supervision des campagnes d'inventaire et du suivi d'avancement."
  }
};

const permissionCatalog: Record<
  IamPermissionCode,
  { label: string; description: string; domain: string }
> = {
  "iam.users.read": {
    label: "Consulter les utilisateurs",
    description: "Voir la liste des utilisateurs et leurs habilitations.",
    domain: "iam"
  },
  "iam.users.create": {
    label: "Creer des utilisateurs",
    description: "Creer des utilisateurs et initialiser leurs habilitations.",
    domain: "iam"
  },
  "iam.users.update": {
    label: "Modifier les habilitations",
    description: "Modifier les roles, perimetres et l'etat d'un utilisateur.",
    domain: "iam"
  },
  "iam.roles.read": {
    label: "Consulter les roles",
    description: "Voir le catalogue des roles.",
    domain: "iam"
  },
  "iam.permissions.read": {
    label: "Consulter les permissions",
    description: "Voir la matrice des permissions.",
    domain: "iam"
  },
  "iam.scopes.read": {
    label: "Consulter les perimetres",
    description: "Voir les perimetres disponibles.",
    domain: "iam"
  },
  "organizations.read": {
    label: "Consulter l'organisation",
    description: "Voir le contexte organisationnel courant.",
    domain: "inventory"
  },
  "organizations.update": {
    label: "Modifier l'organisation",
    description: "Modifier les parametres organisationnels et les conventions visuelles.",
    domain: "inventory"
  },
  "inventory.overview.read": {
    label: "Consulter la synthese inventaire",
    description: "Voir les indicateurs globaux de l'inventaire.",
    domain: "inventory"
  },
  "locations.read": {
    label: "Consulter les localisations",
    description: "Voir les localisations et leurs stocks.",
    domain: "inventory"
  },
  "products.read": {
    label: "Consulter les biens",
    description: "Voir les biens et leurs caracteristiques.",
    domain: "inventory"
  },
  "suppliers.read": {
    label: "Consulter les fournisseurs",
    description: "Voir les fournisseurs rattaches au tenant.",
    domain: "inventory"
  },
  "assets.read": {
    label: "Consulter les equipements",
    description: "Voir les equipements patrimoniaux et leurs affectations.",
    domain: "assets"
  },
  "assets.create": {
    label: "Creer des equipements",
    description: "Creer des equipements patrimoniaux.",
    domain: "assets"
  },
  "assets.update": {
    label: "Modifier des equipements",
    description: "Modifier les equipements patrimoniaux et leurs affectations.",
    domain: "assets"
  },
  "assets.archive": {
    label: "Archiver des equipements",
    description: "Archiver logiquement des equipements.",
    domain: "assets"
  },
  "assets.history.read": {
    label: "Consulter l'historique des equipements",
    description: "Voir la timeline d'un equipement et de ses changements.",
    domain: "assets"
  },
  "asset-references.read": {
    label: "Consulter les referentiels assets",
    description: "Voir les categories, familles, types, marques, modeles, statuts et proprietaires.",
    domain: "assets"
  },
  "asset-references.manage": {
    label: "Administrer les referentiels assets",
    description: "Creer, modifier et archiver les referentiels assets.",
    domain: "assets"
  },
  "spatial.read": {
    label: "Consulter le referentiel spatial",
    description: "Voir les noeuds spatiaux et les perimetres associes.",
    domain: "spatial"
  },
  "spatial.manage": {
    label: "Administrer le referentiel spatial",
    description: "Creer, modifier, archiver et synchroniser les noeuds spatiaux.",
    domain: "spatial"
  },
  "labels.read": {
    label: "Previsualiser les etiquettes",
    description: "Previsualiser les etiquettes equipements et noeuds spatiaux.",
    domain: "labels"
  },
  "labels.export": {
    label: "Exporter les etiquettes",
    description: "Generer les fichiers d etiquettes equipements et noeuds spatiaux.",
    domain: "labels"
  },
  "movements.read": {
    label: "Consulter les mouvements",
    description: "Voir l'historique des mouvements.",
    domain: "movements"
  },
  "movements.create": {
    label: "Creer des mouvements",
    description: "Enregistrer un mouvement de stock.",
    domain: "movements"
  },
  "campaigns.read": {
    label: "Consulter les campagnes",
    description: "Voir les campagnes d'inventaire.",
    domain: "campaigns"
  },
  "campaigns.create": {
    label: "Creer les campagnes",
    description: "Creer une campagne d inventaire equipements.",
    domain: "campaigns"
  },
  "campaigns.update": {
    label: "Modifier les campagnes",
    description: "Modifier le perimetre et les parametres d une campagne.",
    domain: "campaigns"
  },
  "campaigns.execute": {
    label: "Executer les campagnes",
    description: "Scanner les noeuds et equipements d une campagne ouverte.",
    domain: "campaigns"
  },
  "campaigns.review": {
    label: "Revoir les campagnes",
    description: "Controler les observations et anomalies d une campagne.",
    domain: "campaigns"
  },
  "campaigns.archive": {
    label: "Archiver les campagnes",
    description: "Archiver une campagne d inventaire terminee.",
    domain: "campaigns"
  },
  "anomalies.read": {
    label: "Consulter les anomalies",
    description: "Voir les anomalies et ecarts constates.",
    domain: "anomalies"
  },
  "anomalies.update": {
    label: "Traiter les anomalies",
    description: "Qualifier les anomalies et proposer des corrections superviseur.",
    domain: "anomalies"
  },
  "imports.read": {
    label: "Consulter les imports",
    description: "Voir les profils, jobs et rapports d import.",
    domain: "imports"
  },
  "imports.manage": {
    label: "Administrer les imports",
    description: "Creer et modifier les profils et jobs d import.",
    domain: "imports"
  },
  "imports.execute": {
    label: "Executer les imports",
    description: "Lancer les previews, validations et executions d import.",
    domain: "imports"
  },
  "integrations.archicad.read": {
    label: "Consulter l'integration Archicad",
    description: "Voir les informations d'import Archicad.",
    domain: "integrations.archicad"
  },
  "integrations.sap.read": {
    label: "Consulter l'integration SAP",
    description: "Voir les informations d'import SINERGI/SAP.",
    domain: "integrations.sap"
  },
  "reconciliation.read": {
    label: "Consulter le rapprochement",
    description: "Voir les donnees de rapprochement physique/comptable.",
    domain: "reconciliation"
  },
  "reconciliation.manage": {
    label: "Gerer le rapprochement",
    description: "Rattacher ou detacher manuellement une immobilisation d un equipement.",
    domain: "reconciliation"
  },
  "bim3d.read": {
    label: "Consulter la carte 3D",
    description: "Voir les cartes 3D simplifiees des noeuds spatiaux et equipements.",
    domain: "bim3d"
  },
  "bim3d.build": {
    label: "Generer la carte 3D",
    description: "Generer une scene 3D simplifiee depuis les donnees spatiales et IFC4.",
    domain: "bim3d"
  },
  "bim3d.manage": {
    label: "Administrer les cartes 3D",
    description: "Regenerer ou archiver les cartes 3D simplifiees.",
    domain: "bim3d"
  },
  "audit.read": {
    label: "Consulter l'audit",
    description: "Voir les journaux d'audit.",
    domain: "audit"
  }
};

const rolePermissions: Record<IamRoleCode, IamPermissionCode[]> = {
  ADMINISTRATOR: [...IAM_PERMISSION_CODES],
  ASSET_MANAGER: [
    "organizations.read",
    "organizations.update",
    "inventory.overview.read",
    "locations.read",
    "products.read",
    "suppliers.read",
    "assets.read",
    "assets.create",
    "assets.update",
    "assets.archive",
    "assets.history.read",
    "asset-references.read",
    "asset-references.manage",
    "spatial.read",
    "spatial.manage",
    "labels.read",
    "labels.export",
    "movements.read",
    "campaigns.read",
    "campaigns.create",
    "campaigns.update",
    "campaigns.review",
    "campaigns.archive",
    "anomalies.read",
    "anomalies.update",
    "imports.read",
    "imports.manage",
    "imports.execute",
    "integrations.archicad.read",
    "integrations.sap.read",
    "reconciliation.read",
    "reconciliation.manage",
    "bim3d.read",
    "bim3d.build",
    "bim3d.manage"
  ],
  INVENTORY_AGENT: [
    "inventory.overview.read",
    "locations.read",
    "products.read",
    "assets.read",
    "spatial.read",
    "bim3d.read",
    "labels.read",
    "movements.read",
    "movements.create",
    "campaigns.read",
    "campaigns.execute",
    "anomalies.read"
  ],
  ACCOUNTING: [
    "inventory.overview.read",
    "movements.read",
    "integrations.sap.read",
    "reconciliation.read",
    "reconciliation.manage",
    "audit.read"
  ],
  LOGISTICS: [
    "inventory.overview.read",
    "locations.read",
    "products.read",
    "suppliers.read",
    "spatial.read",
    "movements.read",
    "movements.create",
    "bim3d.read"
  ],
  EXTERNAL_PROVIDER: [
    "locations.read",
    "products.read",
    "spatial.read",
    "movements.read",
    "campaigns.read"
  ],
  CAMPAIGN_SUPERVISOR: [
    "inventory.overview.read",
    "locations.read",
    "products.read",
    "movements.read",
    "campaigns.read",
    "campaigns.create",
    "campaigns.update",
    "campaigns.execute",
    "campaigns.review",
    "campaigns.archive",
    "anomalies.read",
    "anomalies.update",
    "bim3d.read",
    "labels.read",
    "labels.export"
  ]
};

async function seedIamCatalog(organizationId: string, adminUserId: string) {
  for (const roleCode of IAM_ROLE_CODES) {
    const role = roleCatalog[roleCode];
    await prisma.iamRole.upsert({
      where: { code: roleCode },
      update: {
        label: role.label,
        description: role.description,
        isSystem: true
      },
      create: {
        code: roleCode,
        label: role.label,
        description: role.description,
        isSystem: true
      }
    });
  }

  for (const permissionCode of IAM_PERMISSION_CODES) {
    const permission = permissionCatalog[permissionCode];
    await prisma.iamPermission.upsert({
      where: { code: permissionCode },
      update: {
        label: permission.label,
        description: permission.description,
        domain: permission.domain
      },
      create: {
        code: permissionCode,
        label: permission.label,
        description: permission.description,
        domain: permission.domain
      }
    });
  }

  const roles = await prisma.iamRole.findMany();
  const permissions = await prisma.iamPermission.findMany();
  const roleByCode = new Map(roles.map((role) => [role.code as IamRoleCode, role]));
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.code as IamPermissionCode, permission])
  );

  for (const [roleCode, codes] of Object.entries(rolePermissions) as [IamRoleCode, IamPermissionCode[]][]) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;
    for (const permissionCode of codes) {
      const permission = permissionByCode.get(permissionCode);
      if (!permission) continue;
      await prisma.iamRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  const siteNode = await upsertSpatialNode({
    organizationId,
    type: SpatialNodeType.SITE,
    code: "HQ",
    label: "Site principal",
    externalSource: SpatialSourceKind.CSV,
    externalRef: "SITE-HQ"
  });
  const site = await upsertScopeFromSpatialNode({
    organizationId,
    nodeId: siteNode.id,
    type: IamAccessScopeType.SITE,
    code: siteNode.code,
    label: siteNode.label,
    externalRef: "SITE-HQ"
  });

  const buildingNode = await upsertSpatialNode({
    organizationId,
    type: SpatialNodeType.BUILDING,
    code: "BAT-A",
    label: "Batiment A",
    parentId: siteNode.id,
    externalSource: SpatialSourceKind.CSV
  });
  const building = await upsertScopeFromSpatialNode({
    organizationId,
    nodeId: buildingNode.id,
    type: IamAccessScopeType.BUILDING,
    code: buildingNode.code,
    label: buildingNode.label,
    parentScopeId: site.id
  });

  const floorNode = await upsertSpatialNode({
    organizationId,
    type: SpatialNodeType.FLOOR,
    code: "RDC",
    label: "Rez-de-chaussee",
    parentId: buildingNode.id,
    externalSource: SpatialSourceKind.CSV
  });
  const floor = await upsertScopeFromSpatialNode({
    organizationId,
    nodeId: floorNode.id,
    type: IamAccessScopeType.FLOOR,
    code: floorNode.code,
    label: floorNode.label,
    parentScopeId: building.id
  });

  const zoneNode = await upsertSpatialNode({
    organizationId,
    type: SpatialNodeType.ZONE,
    code: "STOCK",
    label: "Zone Stock",
    parentId: floorNode.id,
    externalSource: SpatialSourceKind.CSV
  });
  const zone = await upsertScopeFromSpatialNode({
    organizationId,
    nodeId: zoneNode.id,
    type: IamAccessScopeType.ZONE,
    code: zoneNode.code,
    label: zoneNode.label,
    parentScopeId: floor.id
  });

  const roomNode = await upsertSpatialNode({
    organizationId,
    type: SpatialNodeType.ROOM,
    code: "R101",
    label: "Piece R101",
    parentId: zoneNode.id,
    externalSource: SpatialSourceKind.CSV
  });
  const room = await upsertScopeFromSpatialNode({
    organizationId,
    nodeId: roomNode.id,
    type: IamAccessScopeType.ROOM,
    code: roomNode.code,
    label: roomNode.label,
    parentScopeId: zone.id
  });

  const adminRole = roleByCode.get("ADMINISTRATOR");
  if (adminRole) {
    const existing = await prisma.iamUserRole.findFirst({
      where: {
        userId: adminUserId,
        roleId: adminRole.id,
        scopeId: null
      }
    });
    if (!existing) {
      await prisma.iamUserRole.create({
        data: {
          userId: adminUserId,
          roleId: adminRole.id,
          assignedById: adminUserId
        }
      });
    }
  }

  const inventoryAgentRole = roleByCode.get("INVENTORY_AGENT");
  if (inventoryAgentRole) {
    const existing = await prisma.iamUserRole.findFirst({
      where: {
        userId: adminUserId,
        roleId: inventoryAgentRole.id,
        scopeId: room.id
      }
    });
    if (!existing) {
      await prisma.iamUserRole.create({
        data: {
          userId: adminUserId,
          roleId: inventoryAgentRole.id,
          scopeId: room.id,
          assignedById: adminUserId
        }
      });
    }
  }
}

async function seedAssetsCatalog(organizationId: string, adminUserId: string) {
  const roomNode = await prisma.spatialNode.findFirst({
    where: {
      organizationId,
      type: SpatialNodeType.ROOM,
      path: "HQ/BAT-A/RDC/STOCK/R101"
    }
  });

  const category = await prisma.equipmentCategory.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "IT"
      }
    },
    update: {
      label: "Informatique",
      description: "Equipements informatiques et postes de travail.",
      isActive: true
    },
    create: {
      organizationId,
      code: "IT",
      label: "Informatique",
      description: "Equipements informatiques et postes de travail."
    }
  });

  const familyDesk = await prisma.equipmentFamily.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "DESK"
      }
    },
    update: {
      categoryId: category.id,
      label: "Bureau",
      description: "Mobilier de bureau.",
      isActive: true
    },
    create: {
      organizationId,
      categoryId: category.id,
      code: "DESK",
      label: "Bureau",
      description: "Mobilier de bureau."
    }
  });

  const familyComputer = await prisma.equipmentFamily.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "COMPUTER"
      }
    },
    update: {
      categoryId: category.id,
      label: "Ordinateur",
      description: "Postes fixes et portables.",
      isActive: true
    },
    create: {
      organizationId,
      categoryId: category.id,
      code: "COMPUTER",
      label: "Ordinateur",
      description: "Postes fixes et portables."
    }
  });

  const subfamilyDesk = await prisma.equipmentSubfamily.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "WORKSTATION"
      }
    },
    update: {
      familyId: familyDesk.id,
      label: "Poste de travail",
      description: "Plans de travail et bureaux.",
      isActive: true
    },
    create: {
      organizationId,
      familyId: familyDesk.id,
      code: "WORKSTATION",
      label: "Poste de travail",
      description: "Plans de travail et bureaux."
    }
  });

  const subfamilyComputer = await prisma.equipmentSubfamily.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "LAPTOPS"
      }
    },
    update: {
      familyId: familyComputer.id,
      label: "Portables",
      description: "Ordinateurs portables.",
      isActive: true
    },
    create: {
      organizationId,
      familyId: familyComputer.id,
      code: "LAPTOPS",
      label: "Portables",
      description: "Ordinateurs portables."
    }
  });

  const deskType = await prisma.equipmentType.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "DESK-STD"
      }
    },
    update: {
      subfamilyId: subfamilyDesk.id,
      label: "Bureau standard",
      description: "Bureau individuel standard.",
      isActive: true
    },
    create: {
      organizationId,
      subfamilyId: subfamilyDesk.id,
      code: "DESK-STD",
      label: "Bureau standard",
      description: "Bureau individuel standard."
    }
  });

  const laptopType = await prisma.equipmentType.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "LAPTOP"
      }
    },
    update: {
      subfamilyId: subfamilyComputer.id,
      label: "Ordinateur portable",
      description: "Portable bureautique.",
      isActive: true
    },
    create: {
      organizationId,
      subfamilyId: subfamilyComputer.id,
      code: "LAPTOP",
      label: "Ordinateur portable",
      description: "Portable bureautique."
    }
  });

  const brand = await prisma.equipmentBrand.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "DELL"
      }
    },
    update: {
      label: "Dell",
      description: "Constructeur Dell.",
      isActive: true
    },
    create: {
      organizationId,
      code: "DELL",
      label: "Dell",
      description: "Constructeur Dell."
    }
  });

  const genericBrand = await prisma.equipmentBrand.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "GENERIC"
      }
    },
    update: {
      label: "Generique",
      description: "Marque generique.",
      isActive: true
    },
    create: {
      organizationId,
      code: "GENERIC",
      label: "Generique",
      description: "Marque generique."
    }
  });

  const model = await prisma.equipmentModel.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "LATITUDE-7450"
      }
    },
    update: {
      brandId: brand.id,
      label: "Latitude 7450",
      description: "Portable Latitude 7450.",
      isGeneric: false,
      isActive: true
    },
    create: {
      organizationId,
      brandId: brand.id,
      code: "LATITUDE-7450",
      label: "Latitude 7450",
      description: "Portable Latitude 7450."
    }
  });

  const genericModel = await prisma.equipmentModel.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "GENERIC-MODEL"
      }
    },
    update: {
      brandId: genericBrand.id,
      label: "Modele generique",
      description: "Modele non specifie.",
      isGeneric: true,
      isActive: true
    },
    create: {
      organizationId,
      brandId: genericBrand.id,
      code: "GENERIC-MODEL",
      label: "Modele generique",
      description: "Modele non specifie.",
      isGeneric: true
    }
  });

  const status = await prisma.equipmentStatus.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "IN_SERVICE"
      }
    },
    update: {
      label: "En service",
      description: "Actif en exploitation.",
      isActive: true
    },
    create: {
      organizationId,
      code: "IN_SERVICE",
      label: "En service",
      description: "Actif en exploitation."
    }
  });

  const owner = await prisma.ownerEntity.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "COMPANY"
      }
    },
    update: {
      label: "Societe",
      description: "Propriete de la societe.",
      isActive: true
    },
    create: {
      organizationId,
      code: "COMPANY",
      label: "Societe",
      description: "Propriete de la societe."
    }
  });

  await prisma.equipmentFamilyAttachmentRule.upsert({
    where: {
      organizationId_sourceFamilyId_targetFamilyId: {
        organizationId,
        sourceFamilyId: familyComputer.id,
        targetFamilyId: familyDesk.id
      }
    },
    update: {
      isActive: true
    },
    create: {
      organizationId,
      sourceFamilyId: familyComputer.id,
      targetFamilyId: familyDesk.id
    }
  });

  const sharedImmobilization = await prisma.immobilization.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "IMMO-DEMO-001"
      }
    },
    update: {
      label: "Lot poste de travail demo",
      description: "Immobilisation partagee par plusieurs equipements de demonstration.",
      status: "ACTIVE",
      costCenter: "IT-DEMO",
      purchaseValue: "2500.00",
      purchaseDate: new Date("2026-01-15T00:00:00.000Z"),
      serviceStartAt: new Date("2026-02-01T00:00:00.000Z"),
      sourceSystem: "SEED",
      externalRef: "SEED-IMMO-DEMO-001",
      isActive: true
    },
    create: {
      organizationId,
      code: "IMMO-DEMO-001",
      label: "Lot poste de travail demo",
      description: "Immobilisation partagee par plusieurs equipements de demonstration.",
      status: "ACTIVE",
      costCenter: "IT-DEMO",
      purchaseValue: "2500.00",
      purchaseDate: new Date("2026-01-15T00:00:00.000Z"),
      serviceStartAt: new Date("2026-02-01T00:00:00.000Z"),
      sourceSystem: "SEED",
      externalRef: "SEED-IMMO-DEMO-001"
    }
  });

  const deskAsset = await prisma.equipment.upsert({
    where: {
      organizationId_internalCode: {
        organizationId,
        internalCode: "AST-DESK-001"
      }
    },
    update: {
      equipmentTypeId: deskType.id,
      equipmentModelId: genericModel.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      serialNumber: "SER-DESK-001",
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: sharedImmobilization.id
    },
    create: {
      organizationId,
      equipmentTypeId: deskType.id,
      equipmentModelId: genericModel.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      internalCode: "AST-DESK-001",
      serialNumber: "SER-DESK-001",
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: sharedImmobilization.id,
      technicalCharacteristics: "Bureau 160x80",
      notes: "Bureau de demonstration"
    }
  });

  const laptopAsset = await prisma.equipment.upsert({
    where: {
      organizationId_internalCode: {
        organizationId,
        internalCode: "AST-LAP-001"
      }
    },
    update: {
      equipmentTypeId: laptopType.id,
      equipmentModelId: model.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      serialNumber: "SER-LAP-001",
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: sharedImmobilization.id
    },
    create: {
      organizationId,
      equipmentTypeId: laptopType.id,
      equipmentModelId: model.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      internalCode: "AST-LAP-001",
      serialNumber: "SER-LAP-001",
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: sharedImmobilization.id,
      technicalCharacteristics: "Core i7 / 16 Go / 512 Go SSD",
      notes: "Portable de demonstration"
    }
  });

  await prisma.equipment.upsert({
    where: {
      organizationId_internalCode: {
        organizationId,
        internalCode: "AST-NOIMMO-001"
      }
    },
    update: {
      equipmentTypeId: deskType.id,
      equipmentModelId: genericModel.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      serialNumber: null,
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: null
    },
    create: {
      organizationId,
      equipmentTypeId: deskType.id,
      equipmentModelId: genericModel.id,
      equipmentStatusId: status.id,
      ownerEntityId: owner.id,
      internalCode: "AST-NOIMMO-001",
      serialNumber: null,
      currentSpatialNodeId: roomNode?.id ?? null,
      immobilizationId: null,
      technicalCharacteristics: "Equipement sans immobilisation de demonstration",
      notes: "Cas test non rapproche comptablement"
    }
  });

  await prisma.equipmentAssignment.deleteMany({
    where: {
      equipmentId: laptopAsset.id
    }
  });

  await prisma.equipmentAssignment.createMany({
    data: [
      {
        organizationId,
        equipmentId: laptopAsset.id,
        assignmentType: "ASSET",
        targetEquipmentId: deskAsset.id,
        notes: "Rattache au bureau de demonstration"
      },
      {
        organizationId,
        equipmentId: laptopAsset.id,
        assignmentType: "PERSON",
        targetUserId: adminUserId,
        targetPersonName: "Inventory Admin",
        notes: "Affectation interne de demonstration"
      }
    ]
  });
}

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "settings" JSONB');

  let organization;
  try {
    organization = await prisma.organization.upsert({
      where: { slug: "demo-org" },
      update: {
        name: "Demo Organization",
        settings: asJsonValue(buildDefaultOrganizationSettings())
      },
      create: {
        name: "Demo Organization",
        slug: "demo-org",
        settings: asJsonValue(buildDefaultOrganizationSettings())
      }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
      throw error;
    }

    organization = await prisma.organization.upsert({
      where: { slug: "demo-org" },
      update: { name: "Demo Organization" },
      create: {
        name: "Demo Organization",
        slug: "demo-org"
      }
    });
  }

  try {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { settings: asJsonValue(buildDefaultOrganizationSettings()) }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2022") {
      throw error;
    }
  }

  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: "admin@demo.local"
      }
    },
    update: {
      name: "Inventory Admin",
      isActive: true,
      passwordHash: hashPassword("ChangeMe123!"),
      mustChangePassword: false
    },
    create: {
      organizationId: organization.id,
      email: "admin@demo.local",
      name: "Inventory Admin",
      isActive: true,
      passwordHash: hashPassword("ChangeMe123!"),
      mustChangePassword: false
    }
  });

  await seedIamCatalog(organization.id, adminUser.id);

  const warehouse = await prisma.location.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "MAIN"
      }
    },
    update: { name: "Main Warehouse" },
    create: {
      organizationId: organization.id,
      code: "MAIN",
      name: "Main Warehouse",
      description: "Primary storage location"
    }
  });

  const legacyLocationNode = await upsertSpatialNode({
    organizationId: organization.id,
    type: SpatialNodeType.LOCATION,
    code: warehouse.code,
    label: warehouse.name,
    description: warehouse.description,
    legacyLocationId: warehouse.id,
    externalSource: SpatialSourceKind.LEGACY,
    externalRef: "LOC-MAIN"
  });

  await upsertScopeFromSpatialNode({
    organizationId: organization.id,
    nodeId: legacyLocationNode.id,
    type: IamAccessScopeType.LOCATION,
    code: legacyLocationNode.code,
    label: legacyLocationNode.label,
    externalRef: "LOC-MAIN"
  });

  await prisma.productCategory.createMany({
    data: [
      { organizationId: organization.id, code: "COMP", name: "Components" },
      { organizationId: organization.id, code: "CONS", name: "Consumables" }
    ],
    skipDuplicates: true
  });

  await prisma.supplier.createMany({
    data: [
      { organizationId: organization.id, name: "Northwind Supply", email: "sales@northwind.local" },
      { organizationId: organization.id, name: "Contoso Industrial", email: "ops@contoso.local" }
    ],
    skipDuplicates: true
  });

  const categories = await prisma.productCategory.findMany({
    where: { organizationId: organization.id }
  });
  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: organization.id }
  });

  const componentCategory = categories.find((item) => item.code === "COMP");
  const consumableCategory = categories.find((item) => item.code === "CONS");
  const northwind = suppliers.find((item) => item.name === "Northwind Supply");
  const contoso = suppliers.find((item) => item.name === "Contoso Industrial");

  const products = [
    {
      sku: "LAP-001",
      name: "Industrial Laptop",
      categoryId: componentCategory?.id,
      supplierId: northwind?.id,
      minStock: 2
    },
    {
      sku: "BAR-010",
      name: "Barcode Scanner",
      categoryId: componentCategory?.id,
      supplierId: contoso?.id,
      minStock: 4
    },
    {
      sku: "LAB-100",
      name: "Shipping Labels",
      categoryId: consumableCategory?.id,
      supplierId: northwind?.id,
      minStock: 20
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        organizationId_sku: {
          organizationId: organization.id,
          sku: product.sku
        }
      },
      update: {
        name: product.name,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        minStock: product.minStock
      },
      create: {
        organizationId: organization.id,
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId,
        supplierId: product.supplierId,
        minStock: product.minStock
      }
    });
  }

  const seededProducts = await prisma.product.findMany({
    where: { organizationId: organization.id }
  });

  const quantities = new Map([
    ["LAP-001", 5],
    ["BAR-010", 12],
    ["LAB-100", 50]
  ]);

  for (const product of seededProducts) {
    await prisma.stockItem.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: warehouse.id
        }
      },
      update: {
        quantity: quantities.get(product.sku) ?? 0
      },
      create: {
        productId: product.id,
        locationId: warehouse.id,
        quantity: quantities.get(product.sku) ?? 0
      }
    });
  }

  await seedAssetsCatalog(organization.id, adminUser.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
