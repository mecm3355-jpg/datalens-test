import { describe, expect, it } from "vitest";
import type { ApiAnalysis, ApiFile, ApiPreview, ApiSuggestion } from "../../api/datalens";
import {
  cleanRuleKey,
  comparisonRows,
  previewRows,
  toArtifact,
  toCleaningRules,
  toDataFile,
} from "./apiAdapters";

const file: ApiFile = {
  fileId: "file-1",
  originalName: "민원.csv",
  extension: "csv",
  mimeType: "text/csv",
  category: "tabular",
  sizeBytes: 120,
  status: "completed",
  processingCapabilities: {
    preview: true,
    qualityCheck: true,
    cleaning: true,
    statistics: true,
    aiSummary: false,
  },
  createdAt: "2026-10-28T00:00:00Z",
  updatedAt: "2026-10-28T00:00:01Z",
  lastJobId: "job-1",
};

const preview: ApiPreview = {
  fileId: "file-1",
  kind: "table",
  format: "csv",
  limit: 20,
  columns: ["내용", "지역"],
  rows: [["  보도블록 파손  ", "강남"], ["  보도블록 파손  ", "강남"]],
  lines: null,
  thumbnail: null,
};

const analysis: ApiAnalysis = {
  fileId: "file-1",
  jobId: "job-1",
  version: 1,
  quality: {
    score: 83,
    issues: [{
      type: "duplicates",
      severity: "medium",
      count: 1,
      location: null,
      message: "중복 행이 있습니다.",
    }],
    metrics: { completeness: 100, uniqueness: 50, validity: 100, consistency: 100 },
  },
  analysis: { rowCount: 2, columns: [{ name: "내용" }, { name: "지역" }] },
  ai: {},
};

const suggestions: ApiSuggestion[] = [
  {
    rule: { type: "trim_whitespace", column: "내용" },
    reason: "앞뒤 공백을 확인했습니다.",
    expectedChanges: 2,
  },
  {
    rule: { type: "remove_duplicates", columns: ["지역", "내용"] },
    reason: "중복 행을 확인했습니다.",
    expectedChanges: 1,
  },
];

describe("파일 API 화면 변환", () => {
  it("서버 파일과 미리보기를 공통 화면 모델로 변환한다", () => {
    expect(toDataFile(file)).toMatchObject({
      id: "file-1",
      originalName: "민원.csv",
      status: "completed",
      uploadProgress: 100,
    });
    expect(previewRows(preview)[0]).toEqual({ 내용: "  보도블록 파손  ", 지역: "강남" });
  });

  it("추천 규칙과 정제 전후 예시를 같은 규칙 ID로 연결한다", () => {
    const rules = toCleaningRules(suggestions);
    const changes = comparisonRows(previewRows(preview), rules);

    expect(rules).toHaveLength(2);
    expect(changes.some((row) => row.before !== row.after)).toBe(true);
    expect(changes.every((row) => rules.some((rule) => rule.id === row.ruleId))).toBe(true);
  });

  it("품질 결과를 정제 화면과 리포트가 공유하는 산출물로 합친다", () => {
    const artifact = toArtifact(preview, analysis, suggestions);

    expect(artifact.analysis?.quality).toMatchObject({ score: 83, duplicateRows: 1 });
    expect(artifact.qualityIssues).toHaveLength(1);
    expect(artifact.rules).toHaveLength(2);
  });

  it("중복 제거 열 순서가 달라도 같은 승인 규칙으로 판단한다", () => {
    expect(cleanRuleKey({ type: "remove_duplicates", columns: ["지역", "내용"] }))
      .toBe(cleanRuleKey({ type: "remove_duplicates", columns: ["내용", "지역"] }));
  });
});
