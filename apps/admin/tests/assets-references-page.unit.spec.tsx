import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssetReferencesPage from "@/app/assets-references/page";

vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-shell">{children}</div>
}));

vi.mock("@/components/admin-auth-screen", () => ({
  AdminAuthScreen: () => <div>auth</div>
}));

vi.mock("@/lib/session", () => ({
  useStoredToken: () => "demo-token"
}));

vi.mock("@/lib/api", () => ({
  isUnauthorizedApiError: () => false,
  apiFetch: vi.fn(async (path: string) => {
    if (path.startsWith("/assets/references/categories")) {
      return [
        {
          id: "cat-1",
          code: "IT",
          label: "Informatique",
          description: "Materiel informatique",
          isActive: true,
          parentId: null,
          parentLabel: null,
          isGeneric: false
        }
      ];
    }

    if (path.startsWith("/assets/references/families")) {
      return [
        {
          id: "fam-1",
          code: "DESK",
          label: "Bureaux",
          description: null,
          isActive: true,
          parentId: "cat-1",
          parentLabel: "Informatique",
          isGeneric: false
        }
      ];
    }

    if (path.startsWith("/assets/references/subfamilies")) {
      return [];
    }

    if (path.startsWith("/assets/references/brands")) {
      return [];
    }

    return [];
  })
}));

describe("AssetReferencesPage", () => {
  it("renders the categories view with fetched references", async () => {
    render(<AssetReferencesPage />);

    expect(screen.getByText("References assets")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Informatique").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByText("Creer la reference")).toBeInTheDocument();
  });
});
