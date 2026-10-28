import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { categories, categoryById, complaintById, reviews } from "../data/mock";
import { REVIEW_REASON_LABEL } from "../lib/labels";
import { useWorkspace } from "../state/workspace";

export function ReviewsPage() {
  const workspace = useWorkspace();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const rows = reviews.map((review) => ({
    review,
    complaint: complaintById(review.complaintId),
    state: workspace.reviewState(review.id),
  }));
  const pending = rows.filter((row) => row.state.status === "pending").length;

  return (
    <div className="page">
      <PageIntro
        eyebrow={`대기 ${pending}건`}
        title="검토"
        lede="애매한 배정, 긴급 민원, 속성이 비어 있는 민원을 사람이 확정합니다. 아래는 대표 검토 건입니다."
      />
      <DataTable
        rows={rows}
        rowKey={(row) => row.review.id}
        empty="검토 대기 민원이 없습니다."
        columns={[
          {
            key: "id",
            header: "민원",
            render: (row) => (
              <Link className="link" to={`/complaints/${row.review.complaintId}`}>
                {row.review.complaintId}
              </Link>
            ),
          },
          {
            key: "reason",
            header: "이유",
            render: (row) => REVIEW_REASON_LABEL[row.review.reason],
          },
          {
            key: "content",
            header: "본문",
            render: (row) => <span className="content-cell">{row.complaint?.contentMasked ?? "—"}</span>,
          },
          {
            key: "status",
            header: "상태",
            render: (row) => (
              <span className={row.state.status === "pending" ? "pill pill-pending" : "pill"}>
                {row.state.status === "pending" ? "대기" : "확정"}
              </span>
            ),
          },
          {
            key: "action",
            header: "결정",
            render: (row) => {
              if (row.state.status === "done") {
                return categoryById(row.state.reviewedCategoryId)?.name ?? "확정";
              }
              const selected = choice[row.review.id] ?? row.review.suggestedCategoryId ?? categories[0]?.categoryId ?? "";
              return (
                <div className="cluster">
                  <select
                    className="select select-compact"
                    aria-label={`${row.review.complaintId} 카테고리`}
                    value={selected}
                    onChange={(event) =>
                      setChoice((current) => ({ ...current, [row.review.id]: event.target.value }))
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => workspace.confirmReview(row.review.id, selected)}>확정</Button>
                </div>
              );
            },
          },
        ]}
      />
      </div>
  );
}
