import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./okrExportWorkbook";
import type { Quarter } from "../../domain/model";

const quarter: Quarter = {
  quarterId: "2026-q4",
  label: "Q4 2026",
  objectives: [
    {
      id: "O-1",
      type: "objective",
      title: "Ship the thing",
      groups: ["Atlas", "Growth"],
      status: "on_track",
      progress: 40,
      allocation: 60,
      children: [
        {
          id: "O-1-KR1",
          type: "key_result",
          title: "Ship to 100% of traffic",
          status: "on_track",
          progress: 40,
          metricType: "percent",
          current: 40,
          target: 100,
        },
      ],
    },
  ],
};

describe("buildWorkbook", () => {
  it("produces a workbook that round-trips through ExcelJS with the expected sheets and rows", async () => {
    const buffer = await buildWorkbook(quarter.label, quarter);
    expect(buffer.byteLength).toBeGreaterThan(0);

    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);

    const sheetNames = readBack.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual([
      "Q4 2026 (from our OKR app)",
      "Allocation by Cluster",
    ]);

    const dataSheet = readBack.getWorksheet("Q4 2026 (from our OKR app)")!;
    expect(dataSheet.getRow(1).getCell(1).value).toBe("#");
    expect(dataSheet.getRow(2).getCell(4).value).toBe("Ship the thing");

    const clusterSheet = readBack.getWorksheet("Allocation by Cluster")!;
    expect(clusterSheet.getRow(2).getCell(1).value).toBe("Growth");
    expect(clusterSheet.getRow(2).getCell(2).value).toBe(60);
  });
});
