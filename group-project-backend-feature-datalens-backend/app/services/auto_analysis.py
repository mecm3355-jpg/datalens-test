"""업로드 진단이 끝난 파일의 민원 분석을 자동으로 시작한다(사용자 결정 2026-11-02).

흐름: 업로드 → 추출·진단(analyze) → 자동 설정 → 민원 분석(complaint_analysis).
- 표 파일(CSV·XLSX): 열 매핑 추천. 본문·제목 열을 찾지 못하면 사람이 매핑을 정하기를 기다린다
- 문서(PDF·DOCX)·텍스트(TXT, 브라우저 OCR 결과 포함): 내용에 맞는 나누기 규칙을 찾는다.
  맞는 규칙이 없으면(파일 전체가 민원 1건이 되는 것을 막으려고) 사람이 고르기를 기다린다.
  스캔 PDF는 글자 레이어만 보므로 서버 OCR 없이는 규칙을 찾지 못한다
  (프론트가 브라우저 OCR 결과를 TXT로 올리면 그 파일이 다시 이 흐름을 탄다)
"""

import asyncio
import logging
from pathlib import Path

from app.processors.document import DOCUMENT_EXTENSIONS, DocLine, open_document
from app.processors.splitter import detect_rule, load_split_rules
from app.processors.tabular import TABULAR_EXTENSIONS
from app.processors.text import TEXT_EXTENSIONS, open_text
from app.repositories.candidates import CandidateRepository
from app.repositories.categories import CategoryRepository
from app.repositories.complaints import ComplaintRepository
from app.repositories.files import FileRepository
from app.repositories.jobs import JobRepository
from app.repositories.results import ResultRepository
from app.repositories.reviews import ReviewRepository
from app.repositories.taxonomy_changes import TaxonomyChangeRepository
from app.schemas.complaint import COMPLAINT_ANALYSIS_JOB_TYPE
from app.schemas.complaint_api import CandidateDecisionRequest, ComplaintAnalysisRequest
from app.services.complaint_service import ComplaintService
from app.services.dataset_service import DatasetService
from app.services.job_runner import JobContext
from app.services.naming import guess_group

logger = logging.getLogger(__name__)


def detect_split_rule(path: Path, extension: str) -> str | None:
    """문서·텍스트 원본을 읽어 맞는 나누기 규칙 이름을 찾는다. 파일을 읽으므로 스레드에서 부른다.

    파라미터:
        path: 원본 파일 경로
        extension: 확장자(DOCUMENT_EXTENSIONS 또는 TEXT_EXTENSIONS)
    """
    rules = load_split_rules()
    if extension in TEXT_EXTENSIONS:
        with open_text(path, extension) as text:
            return detect_rule((DocLine(text=line) for line in text.lines), rules)
    # OCR 없이 글자 레이어만 본다. 스캔본까지 다시 OCR하면 진단·분석과 합쳐 같은 일을 세 번 한다
    with open_document(path, extension, None, allow_missing_ocr=True) as document:
        return detect_rule(document.entries, rules)


def _complaint_service(ctx: JobContext) -> ComplaintService:
    """작업 소유자 범위로 민원 분석 서비스를 만든다(워커 안에서 API와 같은 업무 로직을 쓰려고).

    파라미터:
        ctx: 작업 실행 정보
    """
    owner = ctx.job.owner_id
    return ComplaintService(
        FileRepository(ctx.db, owner),
        JobRepository(ctx.db, owner),
        ComplaintRepository(ctx.db, owner),
        CategoryRepository(ctx.db),
        CandidateRepository(ctx.db, owner),
        ReviewRepository(ctx.db, owner),
        TaxonomyChangeRepository(ctx.db),
        ctx.storage,
        ctx.settings,
    )


async def approve_new_candidates(ctx: JobContext) -> int:
    """이번 민원 분석이 만든 신규 후보를 바로 카테고리로 승인한다. 승인한 수를 돌려준다.

    사용자 결정(2026-11-02): 업로드만으로 카테고리별 정리까지 이어지도록 사람 승인을 거치지 않는다.
    이름은 제안 초안을 쓰고, 상위 그룹이 없으면(LLM 없음) 핵심어·대표 민원으로 고른다.
    설정 auto_approve_candidates를 끄면 PRD 4장 6단계대로 담당자가 승인한다.

    파라미터:
        ctx: 방금 끝나 가는 complaint_analysis 작업의 실행 정보
    """
    if not ctx.settings.auto_approve_candidates:
        return 0
    service = _complaint_service(ctx)
    approved = 0
    for candidate, exemplars in await service.candidates("pending", None):
        # 이전 파일에서 남아 있는 후보는 건드리지 않고 이번 작업이 만든 후보만 승인한다
        if candidate.job_id != ctx.job.id:
            continue
        # 같은 파일을 다시 분석하면 같은 민원이 다시 후보가 된다. 이미 있는 카테고리와 사실상
        # 같으면 새로 만들지 않고 그 카테고리에 합친다(카테고리 중복 방지)
        existing = await service.same_category(candidate.id)
        if existing is not None:
            request = CandidateDecisionRequest(
                decision="merged", decided_by="자동 승인", merged_into_category_id=existing
            )
        else:
            group = candidate.suggested_group or guess_group(candidate.keywords, exemplars)
            request = CandidateDecisionRequest(
                decision="approved", decided_by="자동 승인", group=group
            )
        await service.decide(str(candidate.id), request)
        approved += 1
    if approved:
        logger.info("신규 후보 자동 승인: job=%s count=%d", ctx.job.id, approved)
    return approved


async def start_complaint_analysis(ctx: JobContext) -> None:
    """진단이 끝난 파일에 자동 설정(열 매핑 또는 나누기 규칙)을 적용해 민원 분석 작업을 등록한다.

    이미 민원 분석을 한 번이라도 한 파일은 건너뛴다. 재진단할 때마다 다시 분석해 사람이
    고친 설정의 결과를 덮어쓰지 않게 하고, Queue 중복 전달에도 작업이 두 번 생기지 않게 한다.

    파라미터:
        ctx: 방금 완료한 analyze 작업의 실행 정보
    """
    extension = ctx.file.extension
    if extension not in TABULAR_EXTENSIONS | DOCUMENT_EXTENSIONS | TEXT_EXTENSIONS:
        return
    owner = ctx.job.owner_id
    jobs = JobRepository(ctx.db, owner)
    if any(job.type == COMPLAINT_ANALYSIS_JOB_TYPE for job in await jobs.list_by_file(ctx.file.id)):
        return

    file_id = str(ctx.file.id)
    files = FileRepository(ctx.db, owner)
    # 속성은 규칙 방식: 사람이 누르지 않은 작업에서 민원 본문을 외부 LLM으로 보내지 않는다
    if extension in TABULAR_EXTENSIONS:
        # 화면의 "매핑 추천"과 같은 서비스를 써서 자동 결과와 화면 제안이 어긋나지 않게 한다
        datasets = DatasetService(
            files, jobs, ResultRepository(ctx.db, owner), ctx.storage, ctx.settings
        )
        suggestion = await datasets.suggest_mapping(file_id)
        if not ({"content", "title"} & suggestion.mapping.mapped().keys()):
            logger.info("자동 분석 건너뜀(본문 열 없음): file=%s", file_id)
            return
        request = ComplaintAnalysisRequest(
            mapping=suggestion.mapping, constants=suggestion.constants, attribute_method="rule"
        )
    else:
        path = ctx.storage.path(ctx.file.storage.key)
        rule = await asyncio.to_thread(detect_split_rule, path, extension)
        if rule is None:
            logger.info("자동 분석 건너뜀(맞는 나누기 규칙 없음): file=%s", file_id)
            return
        request = ComplaintAnalysisRequest(split_rule=rule, attribute_method="rule")

    complaints = ComplaintService(
        files,
        jobs,
        ComplaintRepository(ctx.db, owner),
        CategoryRepository(ctx.db),
        CandidateRepository(ctx.db, owner),
        ReviewRepository(ctx.db, owner),
        TaxonomyChangeRepository(ctx.db),
        ctx.storage,
        ctx.settings,
    )
    job = await complaints.start_analysis(file_id, request)
    logger.info("민원 분석 자동 시작: file=%s job=%s", file_id, job.id)
