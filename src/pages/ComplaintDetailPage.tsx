import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { PageIntro } from "../components/PageIntro";
import { categoryById, complaintById, files, issueById } from "../data/mock";
import { formatDate, formatRatio } from "../lib/format";
import { ASSIGN_LABEL, REVIEW_REASON_LABEL } from "../lib/labels";
import type { Attributes } from "../types";

const ATTRIBUTE_LABEL: Record<keyof Attributes, string> = {
  facility: "대상 시설",
  place: "장소",
  urgency: "긴급도",
  repeat: "반복 여부",
  requestType: "요청 유형",
  affected: "영향 대상",
};

export function ComplaintDetailPage() {
  const { complaintId = "" } = useParams();
  const complaint = complaintById(complaintId);

  if (!complaint) {
    return (
      <div className="page">
        <PageIntro title="민원을 찾을 수 없습니다" />
        <Button variant="secondary" to="/complaints">
          민원 목록
        </Button>
      </div>
    );
  }

  const category = categoryById(complaint.categoryId);
  const runnerUp = categoryById(complaint.runnerUpCategoryId);
  const file = files.find((item) => item.id === complaint.fileId);
  const issue = issueById(complaint.issueId ?? "");
  const locator = complaint.sourceLocator.row
    ? `행 ${complaint.sourceLocator.row}`
    : `페이지 ${complaint.sourceLocator.page ?? "—"}`;

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${complaint.id} · 체계 v${complaint.taxonomyVersion}`}
        title={category?.name ?? "미배정"}
        lede={complaint.contentMasked}
        actions={
          <Button variant="secondary" to="/complaints">
            목록
          </Button>
        }
      />
      <section className="split">
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">속성 6종</h2>
            <span className="caption">{complaint.analyzer}</span>
          </div>
          <dl className="attr-grid">
            {(Object.keys(ATTRIBUTE_LABEL) as Array<keyof Attributes>).map((key) => (
              <div className="attr" key={key}>
                <dt>{ATTRIBUTE_LABEL[key]}</dt>
                <dd>{complaint.attributes[key] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">배정</h2>
            <span className={complaint.needsReview ? "pill pill-pending" : "pill"}>
              {ASSIGN_LABEL[complaint.assignStatus]}
            </span>
          </div>
          <dl className="attr-grid">
            <div className="attr">
              <dt>유사도</dt>
              <dd className="num">{complaint.similarity === null ? "—" : formatRatio(complaint.similarity)}</dd>
            </div>
            <div className="attr">
              <dt>2위 카테고리</dt>
              <dd>{runnerUp?.name ?? "—"}</dd>
            </div>
            <div className="attr">
              <dt>상위 그룹</dt>
              <dd>{complaint.group ?? "—"}</dd>
            </div>
            <div className="attr">
              <dt>접수일</dt>
              <dd className="num">{formatDate(complaint.receivedAt)}</dd>
            </div>
            <div className="attr">
              <dt>지역</dt>
              <dd>{complaint.region ?? "—"}</dd>
            </div>
            <div className="attr">
              <dt>검토 이유</dt>
              <dd>{complaint.reviewReason ? REVIEW_REASON_LABEL[complaint.reviewReason] : "—"}</dd>
            </div>
          </dl>
          <p className="notice">
            원문 위치{" "}
            {file ? (
              <Link className="link" to={`/files/${file.id}`}>
                {file.originalName}
              </Link>
            ) : (
              complaint.fileId
            )}{" "}
            · {locator}
            {complaint.sourceCategory ? ` · 기관 분류 ${complaint.sourceCategory}` : ""}
          </p>
          {issue ? (
            <p className="notice">
              이슈{" "}
              <Link className="link" to={`/issues/${issue.id}`}>
                {issue.place}
              </Link>
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
