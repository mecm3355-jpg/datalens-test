import { AppError } from "../api/AppError";
import type {
  CleaningPreviewRow,
  CleaningRule,
  DemoCleaningArtifact,
  FileAnalysis,
  FrequencyItem,
  NumericSummary,
  QualityProfile,
} from "../types";

const MAX_STORED_ROWS = 1000;
const STRUCTURED_EXTENSIONS = new Set(["csv", "tsv"]);
const TEXT_EXTENSIONS = new Set(["txt", "log"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);
const MISSING_TOKENS = new Set(["", "-", "n/a", "na", "null", "undefined"]);

/** 파일 바이트를 BOM과 한국어 인코딩을 고려해 문자열로 변환합니다. */
async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

/** 구분자 파일을 따옴표와 줄바꿈 규칙에 맞춰 2차원 배열로 파싱합니다. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new AppError("CSV_PARSE_ERROR", "따옴표가 닫히지 않아 표 데이터를 읽을 수 없습니다.");
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

/** 비어 있거나 중복된 헤더를 사용자에게 표시할 수 있는 고유 이름으로 정리합니다. */
function uniqueHeaders(values: string[]): string[] {
  const counts = new Map<string, number>();
  return values.map((value, index) => {
    const base = value.trim() || `열 ${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

/** 중첩 JSON 값을 미리보기 표에 안전하게 표시할 문자열로 변환합니다. */
function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** JSON의 객체 또는 배열을 동일한 키를 가진 행 목록으로 변환합니다. */
function rowsFromJson(value: unknown): Array<Record<string, string>> {
  const values = Array.isArray(value) ? value : [value];
  const records = values.map((item) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([key, cell]) => [key, stringifyCell(cell)]),
      );
    }
    return { 값: stringifyCell(item) };
  });
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return records.map((record) => Object.fromEntries(headers.map((header) => [header, record[header] ?? ""])));
}

/** 문자열의 앞뒤 및 연속 공백을 하나의 공백으로 정규화합니다. */
function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** 일반적인 날짜 구분자를 ISO 날짜 형태로 정규화합니다. */
function normalizeDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})(.*)$/);
  if (!match) return trimmed;
  const [, year, month, day, suffix] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${suffix.trim() ? ` ${suffix.trim()}` : ""}`;
}

/** 결측값 표기에 해당하면 빈 문자열로 통일합니다. */
function normalizeMissing(value: string): string {
  return MISSING_TOKENS.has(value.trim().toLowerCase()) ? "" : value;
}

/** 모든 셀이 비어 있는 행인지 확인합니다. */
function isEmptyRow(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => value.trim() === "");
}

/** 행을 안정적인 문자열 키로 직렬화해 중복 판정에 사용합니다. */
function rowKey(row: Record<string, string>): string {
  return JSON.stringify(Object.entries(row).map(([field, value]) => [field, normalizeWhitespace(value)]));
}

/** 이미지 확장자와 실제 파일 시그니처가 일치하는지 검사합니다. */
async function validateImageSignature(file: File, extension: string): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "png" ? !isPng : !isJpeg) {
    throw new AppError("FILE_TYPE_MISMATCH", "파일 확장자와 실제 이미지 형식이 일치하지 않습니다.");
  }
}

/** 브라우저 이미지 디코더로 이미지의 실제 해상도를 읽습니다. */
async function readImageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null };
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

/** 숫자로 해석 가능한 열의 평균·최솟값·최댓값을 계산합니다. */
function numericSummaries(rows: Array<Record<string, string>>): NumericSummary[] {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return headers.flatMap((field) => {
    const populated = rows.map((row) => row[field]?.trim() ?? "").filter(Boolean);
    const numbers = populated
      .map((value) => Number(value.replaceAll(",", "")))
      .filter((value) => Number.isFinite(value));
    if (numbers.length < 2 || numbers.length / Math.max(populated.length, 1) < 0.6) return [];
    return [{ field, count: numbers.length, average: numbers.reduce((sum, value) => sum + value, 0) / numbers.length, minimum: Math.min(...numbers), maximum: Math.max(...numbers) }];
  });
}

/** 텍스트 셀에서 자주 등장하는 값을 상위 다섯 개까지 집계합니다. */
function valueFrequencies(rows: Array<Record<string, string>>): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const normalized = normalizeWhitespace(value);
      if (!normalized || normalized.length > 40 || Number.isFinite(Number(normalized.replaceAll(",", "")))) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }));
}

/** 누락·중복·형식 일관성을 바탕으로 0~100점 품질 프로필을 계산합니다. */
function qualityProfile(rows: Array<Record<string, string>>, dateFormatIssues: number): QualityProfile {
  const cellCount = rows.reduce((sum, row) => sum + Object.keys(row).length, 0);
  const missingCells = rows.reduce(
    (sum, row) => sum + Object.values(row).filter((value) => MISSING_TOKENS.has(value.trim().toLowerCase())).length,
    0,
  );
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const key = rowKey(row);
    if (seen.has(key)) duplicateRows += 1;
    seen.add(key);
  }
  const completeness = Math.round((1 - missingCells / Math.max(cellCount, 1)) * 100);
  const uniqueness = Math.round((1 - duplicateRows / Math.max(rows.length, 1)) * 100);
  const validity = 100;
  const consistency = Math.round((1 - dateFormatIssues / Math.max(cellCount, 1)) * 100);
  const score = Math.round(completeness * 0.35 + uniqueness * 0.25 + validity * 0.2 + consistency * 0.2);
  return { completeness, uniqueness, validity, consistency, score, missingCells, duplicateRows };
}

/** 정제 미리보기와 규칙, 품질 통계를 구조화 데이터 행에서 생성합니다. */
function inspectRows(
  rows: Array<Record<string, string>>,
  detectedFormat: string,
  truncated: boolean,
  textStats: FileAnalysis["textStats"] = null,
): DemoCleaningArtifact {
  let whitespaceCount = 0;
  let dateCount = 0;
  let emptyCount = 0;
  let missingCount = 0;
  let duplicateCount = 0;
  const preview: CleaningPreviewRow[] = [];
  const seen = new Set<string>();

  rows.forEach((row, rowIndex) => {
    if (isEmptyRow(row)) {
      emptyCount += 1;
      if (preview.length < 16) preview.push({ id: `empty-${rowIndex}`, row: rowIndex + 2, field: "전체 행", before: "(빈 행)", after: "제외됨", ruleId: "remove-empty" });
      return;
    }
    const key = rowKey(row);
    if (seen.has(key)) {
      duplicateCount += 1;
      if (preview.length < 16) preview.push({ id: `duplicate-${rowIndex}`, row: rowIndex + 2, field: "전체 행", before: "중복 행", after: "제외됨", ruleId: "remove-duplicates" });
    }
    seen.add(key);

    for (const [field, original] of Object.entries(row)) {
      const trimmed = normalizeWhitespace(original);
      if (trimmed !== original) {
        whitespaceCount += 1;
        if (preview.length < 16) preview.push({ id: `space-${rowIndex}-${field}`, row: rowIndex + 2, field, before: original, after: trimmed, ruleId: "trim-whitespace" });
      }
      const normalizedDate = normalizeDate(original);
      if (normalizedDate !== original.trim() && /^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
        dateCount += 1;
        if (preview.length < 16) preview.push({ id: `date-${rowIndex}-${field}`, row: rowIndex + 2, field, before: original, after: normalizedDate, ruleId: "normalize-date" });
      }
      const normalizedMissing = normalizeMissing(original);
      if (normalizedMissing !== original && original.trim() !== "") {
        missingCount += 1;
        if (preview.length < 16) preview.push({ id: `missing-${rowIndex}-${field}`, row: rowIndex + 2, field, before: original, after: "(결측값)", ruleId: "normalize-missing" });
      }
    }
  });

  const rules: CleaningRule[] = [
    { id: "trim-whitespace", name: "불필요한 공백 정리", description: "문자열 앞뒤 공백과 연속된 공백을 하나로 정리합니다.", affectedRows: whitespaceCount, severity: "recommended", target: "문자열 열", reason: "불필요한 공백이 검색과 집계 정확도를 낮출 수 있습니다." },
    { id: "normalize-date", name: "날짜 형식 통일", description: "날짜 표현을 YYYY-MM-DD 형식으로 통일합니다.", affectedRows: dateCount, severity: "required", target: "날짜로 감지된 열", reason: "서로 다른 날짜 표기는 정렬과 기간 분석을 방해합니다." },
    { id: "normalize-missing", name: "결측값 표기 통일", description: "N/A, null, 하이픈을 빈 값으로 통일합니다.", affectedRows: missingCount, severity: "recommended", target: "전체 열", reason: "결측값 표기를 통일하면 완전성 계산이 정확해집니다." },
    { id: "remove-duplicates", name: "중복 행 제거", description: "모든 값이 같은 후속 행을 정제 결과에서 제외합니다.", affectedRows: duplicateCount, severity: "required", target: "전체 행", reason: "중복 레코드는 합계와 빈도 분석을 왜곡합니다." },
    { id: "remove-empty", name: "빈 행 제외", description: "값이 하나도 없는 행을 정제 결과에서 제외합니다.", affectedRows: emptyCount, severity: "recommended", target: "전체 행", reason: "빈 행은 분석 대상이 아니며 레코드 수를 부풀립니다." },
  ];

  return {
    source: "parsed",
    truncated,
    rows,
    rules,
    preview,
    analysis: {
      detectedFormat,
      supported: true,
      quality: qualityProfile(rows, dateCount),
      numericSummaries: numericSummaries(rows),
      frequencies: valueFrequencies(rows),
      textStats,
      imageMetadata: null,
      thumbnail: null,
    },
  };
}

/** 업로드 파일을 실제 형식에 맞게 검사하고 브라우저 데모 분석 결과를 생성합니다. */
export async function inspectDemoFile(file: File): Promise<DemoCleaningArtifact> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.size === 0) throw new AppError("EMPTY_FILE", "내용이 없는 파일은 처리할 수 없습니다.");

  if (IMAGE_EXTENSIONS.has(extension)) {
    await validateImageSignature(file, extension);
    const size = await readImageSize(file);
    return {
      source: "metadata",
      truncated: false,
      rows: [{ 파일명: file.name, 형식: extension.toUpperCase(), MIME: file.type || "알 수 없음", 크기: String(file.size), 해상도: size.width && size.height ? `${size.width} × ${size.height}` : "확인 불가" }],
      rules: [],
      preview: [],
      analysis: { detectedFormat: extension.toUpperCase(), supported: true, quality: null, numericSummaries: [], frequencies: [], textStats: null, imageMetadata: size, thumbnail: null },
    };
  }

  if (extension === "json") {
    const text = await readTextFile(file);
    try {
      const allRows = rowsFromJson(JSON.parse(text));
      if (allRows.length === 0) throw new AppError("JSON_EMPTY", "JSON에 분석할 레코드가 없습니다.");
      return inspectRows(allRows.slice(0, MAX_STORED_ROWS), "JSON", allRows.length > MAX_STORED_ROWS);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("JSON_PARSE_ERROR", "JSON 문법을 확인해 주세요. 올바른 객체 또는 배열이 필요합니다.", { cause: error });
    }
  }

  if (STRUCTURED_EXTENSIONS.has(extension)) {
    const text = await readTextFile(file);
    const parsed = parseDelimited(text.replace(/^\uFEFF/, ""), extension === "tsv" ? "\t" : ",");
    if (parsed.length < 2) throw new AppError("TABLE_EMPTY", "헤더와 한 개 이상의 데이터 행이 필요합니다.");
    const headers = uniqueHeaders(parsed[0]);
    const sourceRows = parsed.slice(1);
    const rows = sourceRows.slice(0, MAX_STORED_ROWS).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    );
    return inspectRows(rows, extension.toUpperCase(), sourceRows.length > MAX_STORED_ROWS);
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    const text = await readTextFile(file);
    const lines = text.split(/\r?\n/);
    const rows = lines.slice(0, MAX_STORED_ROWS).map((content, index) => ({ 줄: String(index + 1), 내용: content }));
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return inspectRows(rows, extension.toUpperCase(), lines.length > MAX_STORED_ROWS, { lines: lines.length, words, characters: text.length });
  }

  return {
    source: "metadata",
    truncated: false,
    rows: [{ 파일명: file.name, 형식: extension.toUpperCase() || "알 수 없음", MIME: file.type || "알 수 없음", 크기: String(file.size), 분석지원: "메타데이터만 지원" }],
    rules: [],
    preview: [],
    analysis: { detectedFormat: extension.toUpperCase() || "UNKNOWN", supported: false, quality: null, numericSummaries: [], frequencies: [], textStats: null, imageMetadata: null, thumbnail: null },
  };
}

/** 사용자가 승인한 규칙만 순서대로 적용해 새로운 정제 행 목록을 반환합니다. */
export function applyDemoCleaning(
  rows: Array<Record<string, string>>,
  ruleIds: ReadonlySet<string>,
): Array<Record<string, string>> {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (ruleIds.has("remove-empty") && isEmptyRow(row)) return [];
    if (ruleIds.has("remove-duplicates")) {
      const key = rowKey(row);
      if (seen.has(key)) return [];
      seen.add(key);
    }
    return [Object.fromEntries(
      Object.entries(row).map(([field, value]) => {
        let cleaned = value;
        if (ruleIds.has("trim-whitespace")) cleaned = normalizeWhitespace(cleaned);
        if (ruleIds.has("normalize-date")) cleaned = normalizeDate(cleaned);
        if (ruleIds.has("normalize-missing")) cleaned = normalizeMissing(cleaned);
        return [field, cleaned];
      }),
    )];
  });
}
