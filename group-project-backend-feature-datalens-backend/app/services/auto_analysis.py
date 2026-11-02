"""업로드 진단이 끝난 표 파일의 민원 분석을 자동으로 시작한다(사용자 결정 2026-11-02).

흐름: 업로드 → 추출·진단(analyze) → 열 매핑 추천 → 민원 분석(complaint_analysis).
본문·제목 열을 찾지 못하면 시작하지 않고 사람이 매핑을 정하기를 기다린다.
문서·텍스트는 나누기 규칙을 사람이 골라야 해서 자동으로 시작하지 않는다.
"""

import logging

from app.processors.tabular import TABULAR_EXTENSIONS
from app.repositories.candidates import CandidateRepository
from app.repositories.categories import CategoryRepository
from app.repositories.complaints import ComplaintRepository
from app.repositories.files import FileRepository
from app.repositories.jobs import JobRepository
from app.repositories.results import ResultRepository
from app.repositories.reviews import ReviewRepository
from app.repositories.taxonomy_changes import TaxonomyChangeRepository
from app.schemas.complaint import COMPLAINT_ANALYSIS_JOB_TYPE
from app.schemas.complaint_api import ComplaintAnalysisRequest
from app.services.complaint_service import ComplaintService
from app.services.dataset_service import DatasetService
from app.services.job_runner import JobContext

logger = logging.getLogger(__name__)


async def start_complaint_analysis(ctx: JobContext) -> None:
    """진단이 끝난 표 파일에 매핑 추천을 적용해 민원 분석 작업을 등록한다.

    이미 민원 분석을 한 번이라도 한 파일은 건너뛴다. 재진단할 때마다 다시 분석해 사람이
    고친 매핑 결과를 덮어쓰지 않게 하고, Queue 중복 전달에도 작업이 두 번 생기지 않게 한다.

    파라미터:
        ctx: 방금 완료한 analyze 작업의 실행 정보
    """
    if ctx.file.extension not in TABULAR_EXTENSIONS:
        return
    owner = ctx.job.owner_id
    jobs = JobRepository(ctx.db, owner)
    if any(job.type == COMPLAINT_ANALYSIS_JOB_TYPE for job in await jobs.list_by_file(ctx.file.id)):
        return

    file_id = str(ctx.file.id)
    files = FileRepository(ctx.db, owner)
    # 화면의 "매핑 추천"과 같은 서비스를 써서 자동 결과와 화면 제안이 어긋나지 않게 한다
    datasets = DatasetService(
        files, jobs, ResultRepository(ctx.db, owner), ctx.storage, ctx.settings
    )
    suggestion = await datasets.suggest_mapping(file_id)
    if not ({"content", "title"} & suggestion.mapping.mapped().keys()):
        logger.info("자동 분석 건너뜀(본문 열 없음): file=%s", file_id)
        return

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
    # 속성은 규칙 방식: 사람이 누르지 않은 작업에서 민원 본문을 외부 LLM으로 보내지 않는다
    request = ComplaintAnalysisRequest(
        mapping=suggestion.mapping, constants=suggestion.constants, attribute_method="rule"
    )
    job = await complaints.start_analysis(file_id, request)
    logger.info("민원 분석 자동 시작: file=%s job=%s", file_id, job.id)
