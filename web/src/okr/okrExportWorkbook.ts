import ExcelJS from "exceljs";
import type { Quarter } from "./components/types";
import {
  buildClusterAllocationRows,
  buildExportRows,
  DEFAULT_EXPORT_COLUMNS,
  type ExportColumn,
} from "./okrExport";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
};
const WRAP_TOP: Partial<ExcelJS.Alignment> = {
  wrapText: true,
  vertical: "top",
};

export async function buildWorkbook(
  quarterLabel: string,
  quarter: Quarter,
  columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
  clusters?: string[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(`${quarterLabel} (from our OKR app)`);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const rows = buildExportRows(quarter, columns, clusters);
  for (const row of rows) {
    const added = sheet.addRow(row);
    added.eachCell((cell) => (cell.alignment = WRAP_TOP));
  }

  const clusterSheet = workbook.addWorksheet("Allocation by Cluster");
  clusterSheet.columns = [
    { header: "Cluster", key: "cluster", width: 20 },
    { header: "Allocation %", key: "totalAllocation", width: 14 },
    { header: "Source objective(s)", key: "objectives", width: 70 },
  ];
  clusterSheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  const clusterRows = buildClusterAllocationRows(quarter, clusters);
  for (const row of clusterRows) {
    const added = clusterSheet.addRow(row);
    added.getCell("objectives").alignment = WRAP_TOP;
  }
  const grandTotal = clusterRows.reduce((sum, r) => sum + r.totalAllocation, 0);
  const totalRow = clusterSheet.addRow({
    cluster: "Grand Total",
    totalAllocation: grandTotal,
  });
  totalRow.font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

export async function downloadWorkbook(
  teamLabel: string,
  quarter: Quarter,
  columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS,
  clusters?: string[],
) {
  const buffer = await buildWorkbook(quarter.label, quarter, columns, clusters);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${teamLabel} - ${quarter.label} OKRs.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
