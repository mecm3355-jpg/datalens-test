import type {
  ApiAnalysis,
  ApiCleanRule,
  ApiFile,
  ApiPreview,
  ApiSuggestion,
} from "../../api/datalens";
import type {
  CleaningPreviewRow,
  CleaningRule,
  DataFile,
  DemoCleaningArtifact,
  FrequencyItem,
  NumericSummary,
} from "../../types";

/** 백엔드 파일 응답을 화면 공통 파일 모델로 변환합니다. */
export function toDataFile(file: ApiFile): DataFile {
  return {
    id: file.fileId,
    originalName: file.originalName,
    extension: file.extension,
    fileCategory: file.category,
    sizeBytes: file.sizeBytes,
    status: file.status,
    createdAt: file.createdAt,
    mimeType: file.mimeType,
    storageLocation: "server://managed",
    analysisSupported: file.processingCapabilities.qualityCheck,
    cleaningSupported: file.processingCapabilities.cleaning,
    rowCount: null,
    columns: [],
    mapping: {},
    uploadProgress: file.status === "completed" ? 100 : 0,
  };
}

/** 파일 미리보기를 표 형태의 화면 행으로 변환합니다. */
export function previewRows(preview: ApiPreview): Array<Record<string, string>> {
  if (preview.kind === "text") {
    return (preview.lines ?? []).map((line, index) => ({ 줄: String(index + 1), 내용: line }));
  }
  const columns = preview.columns ?? [];
  return (preview.rows ?? []).map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, String(row[index] ?? "")])),
  );
}

function ruleName(rule: ApiCleanRule): string {
  if (rule.type === "trim_whitespace") return "불필요한 공백 정리";
  if (rule.type === "remove_duplicates") return "중복 행 제거";
  return `결측값 채우기 · ${rule.column}`;
}

function ruleDescription(rule: ApiCleanRule): string {
  if (rule.type === "trim_whitespace") return `${rule.column} 열 값의 앞뒤 공백을 제거합니다.`;
  if (rule.type === "remove_duplicates") return "선택한 열이 같은 후속 행을 정제 결과에서 제외합니다.";
  return `${rule.column} 열의 결측값을 ${rule.strategy} 방식으로 채웁니다.`;
}

/** 서버가 추천한 허용 규칙을 선택 가능한 화면 규칙으로 변환합니다. */
export function toCleaningRules(suggestions: ApiSuggestion[]): CleaningRule[] {
  return suggestions.map((suggestion, index) => ({
    id: `server-rule-${index + 1}`,
    name: ruleName(suggestion.rule),
    description: ruleDescription(suggestion.rule),
    affectedRows: suggestion.expectedChanges,
    severity: suggestion.expectedChanges > 0 ? "recommended" : "required",
    target: "column" in suggestion.rule ? suggestion.rule.column : "전체 행",
    reason: suggestion.reason,
    backendRule: suggestion.rule,
  }));
}

/** 규칙 객체의 키 순서와 무관하게 서버 규칙을 동일한 값으로 비교합니다. */
export function cleanRuleKey(rule: ApiCleanRule): string {
  if (rule.type === "trim_whitespace") return `${rule.type}:${rule.column}`;
  if (rule.type === "remove_duplicates") {
    return `${rule.type}:${[...(rule.columns ?? [])].sort().join(",")}`;
  }
  return `${rule.type}:${rule.column}:${rule.strategy}:${String(rule.value ?? "")}`;
}

/** 제한된 원본 미리보기에서 규칙별 예상 변경 예시를 만듭니다. */
export function comparisonRows(
  rows: Array<Record<string, string>>,
  rules: CleaningRule[],
): CleaningPreviewRow[] {
  const result: CleaningPreviewRow[] = [];
  for (const rule of rules) {
    const payload = rule.backendRule;
    if (!payload) continue;
    if (payload.type === "trim_whitespace") {
      rows.forEach((row, index) => {
        const before = row[payload.column] ?? "";
        const after = before.trim();
        if (before !== after && result.length < 20) {
          result.push({
            id: `${rule.id}-${index}`,
            row: index + 2,
            field: payload.column,
            before,
            after,
            ruleId: rule.id,
          });
        }
      });
    } else if (payload.type === "remove_duplicates") {
      const columns = payload.columns ?? Object.keys(rows[0] ?? {});
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const key = JSON.stringify(columns.map((column) => row[column] ?? ""));
        if (seen.has(key) && result.length < 20) {
          result.push({
            id: `${rule.id}-${index}`,
            row: index + 2,
            field: "전체 행",
            before: "중복 행",
            after: "제외됨",
            ruleId: rule.id,
          });
        }
        seen.add(key);
      });
    } else {
      rows.forEach((row, index) => {
        if ((row[payload.column] ?? "").trim() === "" && result.length < 20) {
          result.push({
            id: `${rule.id}-${index}`,
            row: index + 2,
            field: payload.column,
            before: "(결측값)",
            after: `${payload.strategy} 기준값으로 채움`,
            ruleId: rule.id,
          });
        }
      });
    }
  }
  return result;
}

function statistics(analysis: ApiAnalysis): {
  numeric: NumericSummary[];
  frequencies: FrequencyItem[];
} {
  const raw = analysis.analysis.statistics;
  const rowCount = typeof analysis.analysis.rowCount === "number" ? analysis.analysis.rowCount : 0;
  const columns = Array.isArray(analysis.analysis.columns) ? analysis.analysis.columns : [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { numeric: [], frequencies: [] };
  const numeric: NumericSummary[] = [];
  const frequencies: FrequencyItem[] = [];
  for (const [field, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.mean === "number" && typeof entry.min === "number" && typeof entry.max === "number") {
      const column = columns.find((item) => (
        typeof item === "object" && item !== null && !Array.isArray(item)
          && (item as Record<string, unknown>).name === field
      ));
      const missingCount = column && typeof column === "object" && !Array.isArray(column)
        && typeof (column as Record<string, unknown>).missingCount === "number"
        ? (column as Record<string, number>).missingCount
        : 0;
      numeric.push({
        field,
        count: Math.max(0, rowCount - missingCount),
        average: entry.mean,
        minimum: entry.min,
        maximum: entry.max,
      });
    }
    if (Array.isArray(entry.topValues)) {
      for (const item of entry.topValues.slice(0, 5)) {
        if (!item || typeof item !== "object") continue;
        const pair = item as Record<string, unknown>;
        if (typeof pair.value === "string" && typeof pair.count === "number") {
          frequencies.push({ value: `${field}: ${pair.value}`, count: pair.count });
        }
      }
    }
  }
  return { numeric, frequencies: frequencies.slice(0, 5) };
}

/** 백엔드 미리보기·진단·추천을 기존 상세/정제 화면용 산출물로 합칩니다. */
export function toArtifact(
  preview: ApiPreview,
  analysis: ApiAnalysis,
  suggestions: ApiSuggestion[],
  cleanedPreview: ApiPreview | null = null,
): DemoCleaningArtifact {
  const rows = previewRows(preview);
  const rules = toCleaningRules(suggestions);
  const metrics = analysis.quality.metrics ?? {};
  const derived = statistics(analysis);
  return {
    // API 미리보기의 text 줄도 서버가 실제로 추출한 내용이다. metadata로 표시하면
    // PDF가 정제 불가인 것처럼 잘못 안내되므로 모든 서버 미리보기를 parsed로 본다.
    source: "parsed",
    truncated: (preview.rows?.length ?? preview.lines?.length ?? 0) >= preview.limit,
    rows,
    cleanedRows: cleanedPreview ? previewRows(cleanedPreview) : undefined,
    rules,
    preview: comparisonRows(rows, rules),
    qualityIssues: analysis.quality.issues,
    analysis: {
      detectedFormat: preview.format,
      supported: true,
      quality: analysis.quality.score === null
        ? null
        : {
            completeness: metrics.completeness ?? 100,
            uniqueness: metrics.uniqueness ?? 100,
            validity: metrics.validity ?? 100,
            consistency: metrics.consistency ?? 100,
            score: analysis.quality.score,
            missingCells: analysis.quality.issues
              .filter((issue) => issue.type === "missing_values")
              .reduce((sum, issue) => sum + issue.count, 0),
            duplicateRows: analysis.quality.issues
              .filter((issue) => issue.type === "duplicates")
              .reduce((sum, issue) => sum + issue.count, 0),
          },
      numericSummaries: derived.numeric,
      frequencies: derived.frequencies,
      textStats: null,
      imageMetadata: null,
    },
  };
}
