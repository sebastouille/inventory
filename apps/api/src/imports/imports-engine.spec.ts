import { describe, expect, it } from "vitest";
import { buildImportReport, parseImportBuffer, validateMappingSet } from "./imports-engine";

describe("imports-engine", () => {
  it("parses a CSV buffer into headers and preview rows", () => {
    const csv = Buffer.from("Code,Label\nA-001,Site principal\nA-002,Batiment A", "utf8");

    const parsed = parseImportBuffer(csv, "CSV", {
      headerRowIndex: 1
    });

    expect(parsed.sourceSnapshot.headers).toEqual(["Code", "Label"]);
    expect(parsed.sourceSnapshot.rowCount).toBe(2);
    expect(parsed.rawRows[0]?.values.Code).toBe("A-001");
  });

  it("rejects a mapping set missing mandatory fields", () => {
    const errors = validateMappingSet("equipments", [
      {
        sourceColumn: "Code inventaire",
        targetField: "internalCode",
        transformType: "TRIM"
      }
    ]);

    expect(errors).toContain("Champ cible obligatoire non mappe: equipmentTypeCode");
    expect(errors).toContain("Champ cible obligatoire non mappe: equipmentStatusCode");
    expect(errors).toContain("Champ cible obligatoire non mappe: ownerEntityCode");
  });

  it("accepts the spatial catalog with parentPath and path fields", () => {
    const errors = validateMappingSet("spatial-nodes", [
      {
        sourceColumn: "Type",
        targetField: "type",
        transformType: "TRIM"
      },
      {
        sourceColumn: "Code",
        targetField: "code",
        transformType: "TRIM"
      },
      {
        sourceColumn: "Libelle",
        targetField: "label",
        transformType: "TRIM"
      },
      {
        sourceColumn: "Chemin parent",
        targetField: "parentPath",
        transformType: "TRIM"
      }
    ]);

    expect(errors).toEqual([]);
  });

  it("builds a report with rejected rows when mandatory values are missing", () => {
    const report = buildImportReport({
      targetDomain: "equipments",
      mode: "VALIDATE",
      headers: ["Code inventaire", "Type", "Statut", "Proprietaire"],
      rawRows: [
        {
          rowIndex: 2,
          values: {
            "Code inventaire": "EQ-001",
            Type: "PC",
            Statut: "ACTIVE",
            Proprietaire: "COMPANY"
          }
        },
        {
          rowIndex: 3,
          values: {
            "Code inventaire": null,
            Type: "PC",
            Statut: "ACTIVE",
            Proprietaire: "COMPANY"
          }
        }
      ],
      mappings: [
        {
          sourceColumn: "Code inventaire",
          targetField: "internalCode",
          transformType: "TRIM"
        },
        {
          sourceColumn: "Type",
          targetField: "equipmentTypeCode",
          transformType: "TRIM"
        },
        {
          sourceColumn: "Statut",
          targetField: "equipmentStatusCode",
          transformType: "TRIM"
        },
        {
          sourceColumn: "Proprietaire",
          targetField: "ownerEntityCode",
          transformType: "TRIM"
        }
      ]
    });

    expect(report.summary.rowsRead).toBe(2);
    expect(report.summary.rowsRejected).toBe(1);
    expect(report.rows[0]?.status).toBe("VALID");
    expect(report.rows[1]?.status).toBe("REJECTED");
  });
});
