import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GlobalSearchResponse } from "@inventory/shared";
import { GlobalSearchBox } from "./global-search-box";

const response: GlobalSearchResponse = {
  query: "alp",
  total: 2,
  groups: [
    {
      domain: "assets",
      label: "Equipements",
      items: [
        {
          id: "asset-1",
          domain: "assets",
          title: "Alpha poste",
          code: "EQ-001",
          subtitle: "Poste - Site A",
          href: "/assets/asset-1"
        },
        {
          id: "asset-2",
          domain: "assets",
          title: "Alpine poste",
          code: "EQ-002",
          subtitle: "Poste - Site B",
          href: "/assets/asset-2"
        }
      ]
    }
  ]
};

describe("GlobalSearchBox", () => {
  it("does not open the dropdown below the minimum character threshold", () => {
    render(
      <GlobalSearchBox
        value="al"
        onValueChange={vi.fn()}
        results={null}
        isLoading={false}
        error={null}
        minChars={3}
        onSelect={vi.fn()}
      />
    );

    expect(screen.queryByText("Aucun resultat.")).not.toBeInTheDocument();
    expect(screen.queryByText("Equipements")).not.toBeInTheDocument();
  });

  it("renders grouped suggestions and selects an item with keyboard navigation", () => {
    const onSelect = vi.fn();

    render(
      <GlobalSearchBox
        value="alp"
        onValueChange={vi.fn()}
        results={response}
        isLoading={false}
        error={null}
        minChars={3}
        onSelect={onSelect}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.getByText("Equipements")).toBeInTheDocument();
    expect(screen.getByText("Alpha poste")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(response.groups[0]?.items[1]);
  });

  it("closes the dropdown on escape", () => {
    render(
      <GlobalSearchBox
        value="alp"
        onValueChange={vi.fn()}
        results={response}
        isLoading={false}
        error={null}
        minChars={3}
        onSelect={vi.fn()}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getByText("Alpha poste")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByText("Alpha poste")).not.toBeInTheDocument();
  });
});
