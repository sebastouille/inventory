import { render, screen } from "@testing-library/react";
import { PermissionMatrix } from "@/components/iam/permission-matrix";

describe("PermissionMatrix", () => {
  it("renders permission coverage by role", () => {
    render(
      <PermissionMatrix
        roles={[
          {
            id: "role-1",
            code: "ADMINISTRATOR",
            label: "Administrateur",
            permissions: [
              {
                id: "perm-1",
                code: "iam.users.read",
                label: "Consulter les utilisateurs",
                description: "Voir les comptes",
                domain: "iam"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getAllByText("Administrateur")).not.toHaveLength(0);
    expect(screen.getAllByText("Consulter les utilisateurs")).not.toHaveLength(0);
    expect(screen.getAllByText("Oui")).not.toHaveLength(0);
  });
});
