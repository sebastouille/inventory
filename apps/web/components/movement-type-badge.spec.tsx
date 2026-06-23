import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MovementTypeBadge } from "./movement-type-badge";

describe("MovementTypeBadge", () => {
  it("maps stock movement types to French labels", () => {
    const { rerender } = render(<MovementTypeBadge type="IN" />);
    expect(screen.getByText("Entree")).toBeInTheDocument();

    rerender(<MovementTypeBadge type="OUT" />);
    expect(screen.getByText("Sortie")).toBeInTheDocument();

    rerender(<MovementTypeBadge type="TRANSFER" />);
    expect(screen.getByText("Transfert")).toBeInTheDocument();
  });
});
