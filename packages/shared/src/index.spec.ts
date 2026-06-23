import { describe, expect, it } from "vitest";
import {
  ASSET_ASSIGNMENT_TYPES,
  EQUIPMENT_REFERENCE_RESOURCES,
  IAM_PERMISSION_CODES,
  IAM_ROLE_CODES,
  SPATIAL_NODE_TYPES,
  type AuthContext,
  type IamRoleCode
} from "./index";

describe("@inventory/shared", () => {
  it("exposes multitenant auth context types", () => {
    const role: IamRoleCode = "ADMINISTRATOR";
    const auth: AuthContext = {
      userId: "user-1",
      organizationId: "org-1",
      email: "admin@example.test"
    };

    expect(auth.organizationId).toBe("org-1");
    expect(role).toBe("ADMINISTRATOR");
    expect(IAM_ROLE_CODES).toContain("INVENTORY_AGENT");
    expect(IAM_PERMISSION_CODES).toContain("iam.users.read");
    expect(IAM_PERMISSION_CODES).toContain("assets.read");
    expect(IAM_PERMISSION_CODES).toContain("asset-references.manage");
    expect(IAM_PERMISSION_CODES).toContain("imports.execute");
    expect(IAM_PERMISSION_CODES).toContain("spatial.read");
    expect(ASSET_ASSIGNMENT_TYPES).toEqual(["PERSON", "LOCATION", "ASSET"]);
    expect(EQUIPMENT_REFERENCE_RESOURCES).toContain("attachment-rules");
    expect(SPATIAL_NODE_TYPES).toContain("ROOM");
  });
});
