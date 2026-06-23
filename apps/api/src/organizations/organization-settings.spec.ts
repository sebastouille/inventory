import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationSettings,
  resolveSpatialScopePolicy,
  validateOrganizationSettings
} from "./organization-settings";

describe("organization-settings", () => {
  it("normalizes missing settings with SCOPED by default", () => {
    const settings = normalizeOrganizationSettings(null);

    expect(settings.iam.spatialScopePolicy).toBe("SCOPED");
    expect(settings.spatialDisplay.nodeTypes.SITE.icon).toBe("globe");
  });

  it("reads organization wide policy when present", () => {
    expect(
      resolveSpatialScopePolicy({
        spatialScopePolicy: "ORGANIZATION_WIDE"
      })
    ).toBe("ORGANIZATION_WIDE");
  });

  it("rejects an invalid policy during explicit validation", () => {
    expect(() =>
      validateOrganizationSettings({
        iam: {
          spatialScopePolicy: "INVALID"
        }
      })
    ).toThrow(BadRequestException);
  });
});
