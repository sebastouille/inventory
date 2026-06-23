import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataGrid } from "./data-grid";

describe("DataGrid", () => {
  it("renders rows and emits sort changes", () => {
    const onSortChange = vi.fn();

    render(
      <DataGrid
        rows={[{ id: "1", name: "Alpha" }]}
        columns={[
          {
            key: "name",
            label: "Nom",
            sortable: true,
            render: (item) => item.name
          }
        ]}
        sort="name"
        direction="asc"
        onSortChange={onSortChange}
        getRowId={(item) => item.id}
        getMobileTitle={(item) => item.name}
        emptyTitle="Vide"
        emptyDescription="Aucune ligne"
      />
    );

    expect(screen.getAllByText("Alpha")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /nom/i }));
    expect(onSortChange).toHaveBeenCalledWith("name", "desc");
  });

  it("renders the empty state when there are no rows", () => {
    render(
      <DataGrid
        rows={[]}
        columns={[
          {
            key: "name",
            label: "Nom",
            render: () => null
          }
        ]}
        getRowId={() => "id"}
        getMobileTitle={() => "Titre"}
        emptyTitle="Aucun resultat"
        emptyDescription="Aucune ligne disponible"
      />
    );

    expect(screen.getByText("Aucun resultat")).toBeInTheDocument();
    expect(screen.getByText("Aucune ligne disponible")).toBeInTheDocument();
  });

  it("renders desktop actions inline by default", () => {
    const onAction = vi.fn();

    render(
      <DataGrid
        rows={[{ id: "1", name: "Alpha" }]}
        columns={[
          {
            key: "name",
            label: "Nom",
            render: (item) => item.name
          }
        ]}
        getRowId={(item) => item.id}
        getMobileTitle={(item) => item.name}
        rowActions={[
          {
            label: "Modifier",
            onClick: onAction
          }
        ]}
        emptyTitle="Vide"
        emptyDescription="Aucune ligne"
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
    expect(onAction).toHaveBeenCalledWith({ id: "1", name: "Alpha" });
    expect(screen.queryByLabelText("Actions")).not.toBeInTheDocument();
  });

  it("does not bubble row actions to the row click handler", () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();

    render(
      <DataGrid
        rows={[{ id: "1", name: "Alpha" }]}
        columns={[
          {
            key: "name",
            label: "Nom",
            render: (item) => item.name
          }
        ]}
        getRowId={(item) => item.id}
        getMobileTitle={(item) => item.name}
        onRowClick={onRowClick}
        rowActions={[
          {
            label: "Modifier",
            onClick: onAction
          }
        ]}
        emptyTitle="Vide"
        emptyDescription="Aucune ligne"
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
