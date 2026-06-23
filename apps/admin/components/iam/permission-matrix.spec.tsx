import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermissionMatrix } from "./permission-matrix";

describe("PermissionMatrix", () => {
  it("renders permissions across roles", () => {
    render(
      <PermissionMatrix
        roles={[
          {
            id: "role-admin",
            code: "ADMINISTRATOR",
            label: "Administrateur",
            permissions: [
              {
                id: "perm-read",
                code: "iam.users.read",
                label: "Lire les utilisateurs",
                description: "Consulter les comptes",
                domain: "iam"
              }
            ]
          },
          {
            id: "role-agent",
            code: "INVENTORY_AGENT",
            label: "Agent inventaire",
            permissions: []
          }
        ]}
      />
    );

    expect(screen.getAllByText("Lire les utilisateurs")).not.toHaveLength(0);
    expect(screen.getAllByText("iam.users.read")).not.toHaveLength(0);
    expect(screen.getAllByText("Oui")).toHaveLength(1);
    expect(screen.getAllByText("Non")).not.toHaveLength(0);
  });
});
