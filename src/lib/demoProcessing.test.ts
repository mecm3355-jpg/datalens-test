import { describe, expect, it } from "vitest";
import { applyDemoCleaning, inspectDemoFile } from "./demoProcessing";

describe("inspectDemoFile", () => {
  it("JSON 배열의 품질 지표와 중복 제거 규칙을 계산한다", async () => {
    const file = new File(
      [JSON.stringify([{ id: 1, name: "  서울 " }, { id: 1, name: "  서울 " }, { id: 2, name: "N/A" }])],
      "sample.json",
      { type: "application/json" },
    );

    const artifact = await inspectDemoFile(file);

    expect(artifact.analysis?.detectedFormat).toBe("JSON");
    expect(artifact.analysis?.quality?.duplicateRows).toBe(1);
    expect(artifact.rules.find((rule) => rule.id === "remove-duplicates")?.affectedRows).toBe(1);
    expect(artifact.rules.find((rule) => rule.id === "normalize-missing")?.affectedRows).toBe(1);
  });

  it("사용자가 승인한 규칙만 정제 결과에 적용한다", () => {
    const rows = [{ 이름: "  데이터  " }, { 이름: "  데이터  " }];
    const whitespaceOnly = applyDemoCleaning(rows, new Set(["trim-whitespace"]));
    const deduplicated = applyDemoCleaning(rows, new Set(["trim-whitespace", "remove-duplicates"]));

    expect(whitespaceOnly).toHaveLength(2);
    expect(whitespaceOnly[0].이름).toBe("데이터");
    expect(deduplicated).toHaveLength(1);
  });
});
