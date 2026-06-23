import * as XLSX from "xlsx";

export function buildOdsExport(
  sheetName: string,
  rows: Record<string, string | number | boolean | null>[]
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: "ods",
    compression: true
  }) as Uint8Array;

  return Buffer.from(output);
}
