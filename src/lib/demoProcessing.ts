import type { CleaningPreviewRow, CleaningRule, DemoCleaningArtifact } from "../types";

const MAX_STORED_ROWS = 1000;
const TEXT_EXTENSIONS = new Set(["csv", "tsv", "txt"]);

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

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function uniqueHeaders(values: string[]): string[] {
  const counts = new Map<string, number>();
  return values.map((value, index) => {
    const base = value.trim() || `열 ${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})(.*)$/);
  if (!match) return trimmed;
  const [, year, month, day, suffix] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${suffix.trim() ? ` ${suffix.trim()}` : ""}`;
}

function isEmptyRow(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => value.trim() === "");
}

export async function inspectDemoFile(file: File): Promise<DemoCleaningArtifact> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      source: "metadata",
      truncated: false,
      rows: [{ 파일명: file.name, 형식: extension.toUpperCase() || "알 수 없음", 크기: String(file.size) }],
      rules: [],
      preview: [],
    };
  }

  const text = await readTextFile(file);
  const delimiter = extension === "tsv" ? "\t" : extension === "csv" ? "," : "\t";
  const parsed = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter);
  if (parsed.length === 0) throw new Error("파일에서 읽을 수 있는 데이터가 없습니다.");

  const headers = uniqueHeaders(parsed[0]);
  const sourceRows = parsed.slice(1);
  const rows = sourceRows.slice(0, MAX_STORED_ROWS).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );

  let whitespaceCount = 0;
  let dateCount = 0;
  let emptyCount = 0;
  const preview: CleaningPreviewRow[] = [];

  rows.forEach((row, rowIndex) => {
    if (isEmptyRow(row)) {
      emptyCount += 1;
      if (preview.length < 12) {
        preview.push({
          id: `empty-${rowIndex}`,
          row: rowIndex + 2,
          field: "전체 행",
          before: "(빈 행)",
          after: "제외됨",
          ruleId: "remove-empty",
        });
      }
      return;
    }

    for (const [field, original] of Object.entries(row)) {
      const trimmed = normalizeWhitespace(original);
      if (trimmed !== original) {
        whitespaceCount += 1;
        if (preview.length < 12) {
          preview.push({
            id: `space-${rowIndex}-${field}`,
            row: rowIndex + 2,
            field,
            before: original,
            after: trimmed,
            ruleId: "trim-whitespace",
          });
        }
      }
      const normalizedDate = normalizeDate(original);
      if (normalizedDate !== original.trim() && /^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
        dateCount += 1;
        if (preview.length < 12) {
          preview.push({
            id: `date-${rowIndex}-${field}`,
            row: rowIndex + 2,
            field,
            before: original,
            after: normalizedDate,
            ruleId: "normalize-date",
          });
        }
      }
    }
  });

  const unchangedRows = rows.filter((row) => !isEmptyRow(row)).slice(0, 2);
  unchangedRows.forEach((row, index) => {
    const [field, value] = Object.entries(row)[0] ?? ["행", ""];
    preview.push({
      id: `unchanged-${index}`,
      row: index + 2,
      field,
      before: value,
      after: value,
      ruleId: "trim-whitespace",
    });
  });

  const rules: CleaningRule[] = [
    {
      id: "trim-whitespace",
      name: "불필요한 공백 정리",
      description: "문자열 앞뒤 공백과 연속된 공백을 하나로 정리합니다.",
      affectedRows: whitespaceCount,
      severity: "recommended",
    },
    {
      id: "normalize-date",
      name: "날짜 형식 통일",
      description: "날짜 표현을 YYYY-MM-DD 형식으로 통일합니다.",
      affectedRows: dateCount,
      severity: "required",
    },
    {
      id: "remove-empty",
      name: "빈 행 제외",
      description: "값이 하나도 없는 행을 정제 결과에서 제외합니다.",
      affectedRows: emptyCount,
      severity: "recommended",
    },
  ];

  return {
    source: "parsed",
    truncated: sourceRows.length > MAX_STORED_ROWS,
    rows,
    rules,
    preview,
  };
}

export function applyDemoCleaning(
  rows: Array<Record<string, string>>,
  ruleIds: ReadonlySet<string>,
): Array<Record<string, string>> {
  const filteredRows = ruleIds.has("remove-empty") ? rows.filter((row) => !isEmptyRow(row)) : rows;
  return filteredRows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([field, value]) => {
        let cleaned = value;
        if (ruleIds.has("trim-whitespace")) cleaned = normalizeWhitespace(cleaned);
        if (ruleIds.has("normalize-date")) cleaned = normalizeDate(cleaned);
        return [field, cleaned];
      }),
    ),
  );
}
