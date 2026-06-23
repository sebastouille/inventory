import type { OrganizationSettings, OrganizationSpatialScopePolicy } from "./organizations";
import type { LoginResponse } from "./auth";

export const IAM_ROLE_CODES = [
  "ADMINISTRATOR",
  "ASSET_MANAGER",
  "INVENTORY_AGENT",
  "ACCOUNTING",
  "LOGISTICS",
  "EXTERNAL_PROVIDER",
  "CAMPAIGN_SUPERVISOR"
] as const;

export type IamRoleCode = (typeof IAM_ROLE_CODES)[number];

export const IAM_SCOPE_TYPES = [
  "SITE",
  "BUILDING",
  "FLOOR",
  "ZONE",
  "ROOM",
  "LOCATION"
] as const;

export type IamScopeType = (typeof IAM_SCOPE_TYPES)[number];

export const IAM_PERMISSION_CODES = [
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

export type IamPermissionCode = (typeof IAM_PERMISSION_CODES)[number];

export interface IamRoleSummary {
  id: string;
  code: IamRoleCode;
  label: string;
  description: string;
  isSystem: boolean;
}

export interface IamRoleDetail extends IamRoleSummary {
  permissions: IamPermissionSummary[];
}

export interface IamPermissionSummary {
  id: string;
  code: IamPermissionCode;
  label: string;
  description: string;
  domain: string;
}

export interface IamScopeSummary {
  id: string;
  type: IamScopeType;
  code: string;
  label: string;
  parentScopeId: string | null;
  path: string | null;
  spatialNodeId: string | null;
  externalRef: string | null;
  isActive: boolean;
}

export interface IamRoleAssignmentSummary {
  id: string;
  roleId: string;
  roleCode: IamRoleCode;
  roleLabel: string;
  scopeId: string | null;
  scopeLabel: string | null;
  scopeType: IamScopeType | null;
  scopePath: string | null;
  scopeSpatialNodeId: string | null;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  roles: IamRoleSummary[];
  permissions: IamPermissionCode[];
  scopeAssignments: IamRoleAssignmentSummary[];
  organizationSettings: OrganizationSettings;
  spatialScopePolicy: OrganizationSpatialScopePolicy;
  isOrganizationWideSpatialAccess: boolean;
  primaryRoleLabel: string | null;
}

export interface IamUserListItem {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  roles: IamRoleSummary[];
}

export interface IamUserDetail extends IamUserListItem {
  scopeAssignments: IamRoleAssignmentSummary[];
}

export interface IamUsersListQuery {
  page?: number;
  pageSize?: number;
  sort?: "name" | "email" | "createdAt";
  direction?: "asc" | "desc";
  q?: string;
  roleId?: string;
  isActive?: "true" | "false";
}

export interface IamRolesListQuery {
  page?: number;
  pageSize?: number;
  sort?: "label" | "code";
  direction?: "asc" | "desc";
  q?: string;
}

export interface CreateUserRoleAssignmentInput {
  roleId: string;
  scopeId?: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
  isActive?: boolean;
  roleAssignments: CreateUserRoleAssignmentInput[];
}

export interface ReplaceUserRolesInput {
  roleAssignments: CreateUserRoleAssignmentInput[];
}

export interface ResetUserPasswordInput {
  temporaryPassword: string;
}

export type AuthLoginResponse = LoginResponse;
