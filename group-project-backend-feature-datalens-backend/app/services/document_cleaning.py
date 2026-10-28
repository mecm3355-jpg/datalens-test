"""PDF·DOCX에서 추출한 글자 줄을 표처럼 정제한다."""

from pathlib import Path

from app.core.errors import AppError
from app.processors.document import OcrOptions, open_document
from app.processors.tabular import Cell
from app.schemas.cleaning import CleanRule, RemoveDuplicatesRule, TrimWhitespaceRule
from app.services.cleaning import RuleChange, check_columns
from app.services.suggestions import Suggestion

DOCUMENT_COLUMNS = ["줄", "내용"]
CONTENT_COLUMN = "내용"


def normalize_text(value: str) -> str:
    """앞뒤 공백과 연속된 줄 안 공백을 한 칸으로 정규화한다."""
    # DOCX 표 행은 칸 경계를 탭으로 표현하므로 탭은 보존하고 각 칸 내부 공백만 고친다.
    return "\t".join(" ".join(part.split()) for part in value.split("\t"))


def read_document_rows(
    path: Path, extension: str, ocr: OcrOptions | None
) -> list[list[Cell]]:
    """문서 전체를 읽어 ``줄``·``내용`` 행으로 바꾼다."""
    with open_document(path, extension, ocr, allow_missing_ocr=True) as document:
        return [[index, entry.text] for index, entry in enumerate(document.entries, start=1)]


def suggest_document_rules(
    path: Path, extension: str, ocr: OcrOptions | None
) -> list[Suggestion]:
    """기존 분석 버전과 관계없이 현재 문서 원문에서 안전한 정제 규칙을 추천한다."""
    rows = read_document_rows(path, extension, ocr)
    values = [str(row[1]) for row in rows]
    normalized = [normalize_text(value) for value in values]
    whitespace = sum(value != clean for value, clean in zip(values, normalized, strict=True))
    duplicates = len(normalized) - len(set(normalized))
    suggestions: list[Suggestion] = []
    if whitespace:
        suggestions.append(
            Suggestion(
                TrimWhitespaceRule(type="trim_whitespace", column=CONTENT_COLUMN),
                f"추출한 문장 {whitespace}개에 불필요한 공백이 있습니다.",
                whitespace,
            )
        )
    if duplicates:
        suggestions.append(
            Suggestion(
                RemoveDuplicatesRule(type="remove_duplicates"),
                f"내용이 같은 중복 문장 {duplicates}개가 있습니다.",
                duplicates,
            )
        )
    return suggestions


def check_document_rules(rules: list[CleanRule]) -> None:
    """문서 정제에서 허용하는 규칙과 열 이름을 확인한다."""
    for rule in rules:
        if isinstance(rule, TrimWhitespaceRule):
            if rule.column != CONTENT_COLUMN:
                check_columns(DOCUMENT_COLUMNS, [rule])
        elif isinstance(rule, RemoveDuplicatesRule):
            if rule.columns:
                check_columns(DOCUMENT_COLUMNS, [rule])
        else:
            raise AppError(
                "RULE_NOT_SUPPORTED",
                "문서는 공백 정규화와 중복 내용 제거 규칙만 지원합니다.",
                422,
            )


def apply_document_rules(
    rows: list[list[Cell]], rules: list[CleanRule]
) -> tuple[list[list[Cell]], list[RuleChange]]:
    """추출한 문서 행에 승인된 규칙을 순서대로 적용한다."""
    check_document_rules(rules)
    current = [list(row) for row in rows if row]
    changes: list[RuleChange] = []
    for rule in rules:
        if isinstance(rule, TrimWhitespaceRule):
            affected = 0
            for row in current:
                value = row[1]
                if isinstance(value, str):
                    normalized = normalize_text(value)
                    if normalized != value:
                        row[1] = normalized
                        affected += 1
        elif isinstance(rule, RemoveDuplicatesRule):
            # 열을 생략하면 문서에서는 줄 번호가 아닌 실제 내용 기준으로 중복을 판단한다.
            names = rule.columns or [CONTENT_COLUMN]
            indexes = [DOCUMENT_COLUMNS.index(name) for name in names]
            seen: set[tuple[str, ...]] = set()
            kept: list[list[Cell]] = []
            for row in current:
                key = tuple(str(row[index]).strip() for index in indexes)
                if key not in seen:
                    seen.add(key)
                    kept.append(row)
            affected = len(current) - len(kept)
            current = kept
        else:
            # check_document_rules가 앞에서 같은 분기를 거부하므로 실행될 수 없다.
            raise AssertionError("unsupported document cleaning rule")
        changes.append(RuleChange(rule, affected))
    return current, changes
