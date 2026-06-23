import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleAssignmentEditor } from "@/components/iam/role-assignment-editor";

describe("RoleAssignmentEditor", () => {
  it("adds a role assignment when a role is checked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <RoleAssignmentEditor
        roles={[
          {
            id: "role-1",
            code: "ADMINISTRATOR",
            label: "Administrateur",
            description: "Administration",
            isSystem: true
          }
        ]}
        scopes={[
          {
            id: "scope-1",
            type: "SITE",
            code: "HQ",
            label: "Site principal",
            parentScopeId: null,
            path: "HQ",
            spatialNodeId: "node-1",
            externalRef: null,
            isActive: true
          }
        ]}
        value={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith([{ roleId: "role-1", scopeId: null }]);
  });

  it("shows the information banner in organization wide mode", () => {
    render(
      <RoleAssignmentEditor
        roles={[]}
        scopes={[]}
        spatialScopePolicy="ORGANIZATION_WIDE"
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/ignores tant que l organisation est en mode/i)).toBeInTheDocument();
  });
});
