import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetAssignmentEditor } from "@/components/assets/asset-assignment-editor";

describe("AssetAssignmentEditor", () => {
  it("adds a default person assignment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<AssetAssignmentEditor assignments={[]} users={[]} assets={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /ajouter une affectation/i }));

    expect(onChange).toHaveBeenCalledWith([
      {
        assignmentType: "PERSON",
        targetUserId: null,
        targetPersonName: null,
        targetLocationId: null,
        targetEquipmentId: null,
        startsAt: null,
        endsAt: null,
        notes: null
      }
    ]);
  });

  it("updates the free person name on an existing assignment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AssetAssignmentEditor
        assignments={[
          {
            assignmentType: "PERSON",
            targetUserId: null,
            targetPersonName: null,
            targetLocationId: null,
            targetEquipmentId: null,
            startsAt: null,
            endsAt: null,
            notes: null
          }
        ]}
        users={[]}
        assets={[]}
        onChange={onChange}
      />
    );

    await user.type(screen.getByPlaceholderText("Nom de la personne"), "M");

    await waitFor(() => {
      const calls = onChange.mock.calls;
          expect(calls.at(-1)?.[0]).toEqual([
            expect.objectContaining({
              assignmentType: "PERSON",
              targetPersonName: "M"
            })
          ]);
    });
  });
});
