import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { categoryById, complaintsByIssue, issueById } from "../data/mock";
import { formatDate, formatNumber } from "../lib/format";
import { ASSIGN_LABEL } from "../lib/labels";

export function IssueDetailPage() {
  const { issueId = "" } = useParams();
  const issue = issueById(issueId);
  if (!issue) {
    return (
      <div className="page">
        <PageIntro title="이슈를 찾을 수 없습니다" />
        <Button variant="secondary" to="/issues">
          이슈 목록
        </Button>
      </div>
    );
  }

  const samples = complaintsByIssue(issue.id);
  const category = categoryById(issue.categoryId);

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${issue.region} · ${issue.status === "open" ? "진행" : "해소"}`}
        title={issue.place}
        lede={issue.summary}
        actions={
          <Button variant="secondary" to={`/complaints?category=${issue.categoryId}`}>
            같은 카테고리
          </Button>
        }
      />
      <section className="stat-row">
        <article className="stat">
          <p className="stat-label">묶인 민원</p>
          <p className="stat-value">{formatNumber(issue.complaintCount)}</p>
          <p className="stat-foot">대표 {formatNumber(samples.length)}건</p>
        </article>
        <article className="stat">
          <p className="stat-label">카테고리</p>
          <p className="title-md">{category?.name}</p>
          <p className="stat-foot">{category?.group}</p>
        </article>
        <article className="stat">
          <p className="stat-label">최고 긴급도</p>
          <p className="title-md">{issue.maxUrgency}</p>
          <p className="stat-foot">
            {formatDate(issue.firstReceivedAt)} – {formatDate(issue.lastReceivedAt)}
          </p>
        </article>
      </section>
      <DataTable
        rows={samples}
        rowKey={(row) => row.id}
        empty="연결된 대표 민원이 없습니다."
        columns={[
          {
            key: "id",
            header: "민원",
            render: (row) => (
              <Link className="link" to={`/complaints/${row.id}`}>
                {row.id}
              </Link>
            ),
          },
          { key: "date", header: "접수일", numeric: true, render: (row) => formatDate(row.receivedAt) },
          { key: "content", header: "본문", render: (row) => <span className="content-cell">{row.contentMasked}</span> },
          { key: "repeat", header: "반복", render: (row) => row.attributes.repeat ?? "—" },
          { key: "status", header: "배정", render: (row) => ASSIGN_LABEL[row.assignStatus] },
        ]}
      />
    </div>
  );
}
