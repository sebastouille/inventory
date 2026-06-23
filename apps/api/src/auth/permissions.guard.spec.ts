import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { PermissionsGuard } from "./permissions.guard";

describe("PermissionsGuard", () => {
  const makeContext = (permissions: string[]): ExecutionContext =>
    ({
      getHandler: () => "handler",
      getClass: () => "class",
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            permissions
          }
        })
      })
    }) as unknown as ExecutionContext;

  it("allows access when the required permission is present", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["iam.users.read"])
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(makeContext(["iam.users.read"]))).toBe(true);
  });

  it("rejects access when the permission is missing", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["iam.users.update"])
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(makeContext(["iam.users.read"]))).toThrow(ForbiddenException);
  });
});
