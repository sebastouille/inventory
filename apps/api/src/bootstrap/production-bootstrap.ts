import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildDefaultOrganizationSettings,
  IAM_PERMISSION_CODES,
  listPasswordPolicyViolations,
  type IamPermissionCode
} from "@inventory/shared";
import { hashPassword } from "../auth/password";

const prisma = new PrismaClient();

const ADMINISTRATOR_ROLE_CODE = "ADMINISTRATOR";
const DEMO_ORGANIZATION_SLUG = "demo-org";
const DEMO_ADMIN_EMAIL = "admin@demo.local";
const DEMO_ADMIN_PASSWORD = "ChangeMe123!";

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when INVENTORY_BOOTSTRAP_ENABLED=true`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function requireNonDemoBootstrap(input: {
  organizationSlug: string;
  adminEmail: string;
  adminPassword: string;
}) {
  if (input.organizationSlug.toLowerCase() === DEMO_ORGANIZATION_SLUG) {
    throw new Error("Production bootstrap refuses the demo organization slug");
  }

  if (input.adminEmail.toLowerCase() === DEMO_ADMIN_EMAIL) {
    throw new Error("Production bootstrap refuses the demo admin email");
  }

  if (input.adminPassword === DEMO_ADMIN_PASSWORD) {
    throw new Error("Production bootstrap refuses the demo admin password");
  }
}

function assertPasswordPolicy(password: string) {
  const violations = listPasswordPolicyViolations(password);
  if (violations.length > 0) {
    throw new Error(`INVENTORY_BOOTSTRAP_ADMIN_PASSWORD is invalid: ${violations.join(", ")}`);
  }
}

function getPermissionDomain(code: IamPermissionCode) {
  if (code.startsWith("asset-references.")) {
    return "assets";
  }
  if (code.startsWith("integrations.")) {
    return code.split(".").slice(0, 2).join(".");
  }
  return code.split(".")[0];
}

function getPermissionLabel(code: IamPermissionCode) {
  return code.replace(/[.-]/g, " ");
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function upsertOrganization(input: { name: string; slug: string }) {
  const current = await prisma.organization.findUnique({
    where: { slug: input.slug },
    select: { id: true, settings: true }
  });

  if (current) {
    return prisma.organization.update({
      where: { id: current.id },
      data: {
        name: input.name,
        settings: current.settings ?? asJsonValue(buildDefaultOrganizationSettings())
      }
    });
  }

  return prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      settings: asJsonValue(buildDefaultOrganizationSettings())
    }
  });
}

async function upsertIamCatalog() {
  const role = await prisma.iamRole.upsert({
    where: { code: ADMINISTRATOR_ROLE_CODE },
    update: {
      label: "Administrateur",
      description: "Administration de la plateforme, des habilitations et de la configuration.",
      isSystem: true
    },
    create: {
      code: ADMINISTRATOR_ROLE_CODE,
      label: "Administrateur",
      description: "Administration de la plateforme, des habilitations et de la configuration.",
      isSystem: true
    }
  });

  for (const code of IAM_PERMISSION_CODES) {
    await prisma.iamPermission.upsert({
      where: { code },
      update: {
        label: getPermissionLabel(code),
        description: `Permission ${code}`,
        domain: getPermissionDomain(code)
      },
      create: {
        code,
        label: getPermissionLabel(code),
        description: `Permission ${code}`,
        domain: getPermissionDomain(code)
      }
    });
  }

  const permissions = await prisma.iamPermission.findMany({
    where: {
      code: {
        in: [...IAM_PERMISSION_CODES]
      }
    },
    select: { id: true }
  });

  for (const permission of permissions) {
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

  return role;
}

async function upsertInitialAdmin(input: {
  organizationId: string;
  email: string;
  name: string;
  password: string;
  mustChangePassword: boolean;
  administratorRoleId: string;
}) {
  const existing = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.email
      }
    },
    select: { id: true, name: true }
  });

  const adminUser = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? input.name,
          isActive: true
        }
      })
    : await prisma.user.create({
        data: {
          organizationId: input.organizationId,
          email: input.email,
          name: input.name,
          isActive: true,
          passwordHash: hashPassword(input.password),
          mustChangePassword: input.mustChangePassword
        }
      });

  const existingAssignment = await prisma.iamUserRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: input.administratorRoleId,
      scopeId: null
    },
    select: { id: true }
  });

  if (!existingAssignment) {
    await prisma.iamUserRole.create({
      data: {
        userId: adminUser.id,
        roleId: input.administratorRoleId,
        assignedById: adminUser.id
      }
    });
  }

  return adminUser;
}

async function main() {
  if (!isEnabled(process.env.INVENTORY_BOOTSTRAP_ENABLED)) {
    console.log("Production bootstrap skipped");
    return;
  }

  const organizationName = optionalEnv("INVENTORY_BOOTSTRAP_ORGANIZATION_NAME", "Inventory");
  const organizationSlug = requireEnv("INVENTORY_BOOTSTRAP_ORGANIZATION_SLUG");
  const adminEmail = requireEnv("INVENTORY_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const adminName = optionalEnv("INVENTORY_BOOTSTRAP_ADMIN_NAME", "Inventory Admin");
  const adminPassword = requireEnv("INVENTORY_BOOTSTRAP_ADMIN_PASSWORD");
  const mustChangePassword = process.env.INVENTORY_BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD !== "false";

  requireNonDemoBootstrap({
    organizationSlug,
    adminEmail,
    adminPassword
  });
  assertPasswordPolicy(adminPassword);

  const organization = await upsertOrganization({
    name: organizationName,
    slug: organizationSlug
  });
  const administratorRole = await upsertIamCatalog();
  const adminUser = await upsertInitialAdmin({
    organizationId: organization.id,
    email: adminEmail,
    name: adminName,
    password: adminPassword,
    mustChangePassword,
    administratorRoleId: administratorRole.id
  });

  console.log(
    `Production bootstrap ready for organization ${organization.slug} with admin ${adminUser.email}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
