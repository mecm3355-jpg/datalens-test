import { useState } from "react";
import { Button } from "../components/Button";
import { CategoryTabs } from "../components/CategoryTabs";
import { PageIntro } from "../components/PageIntro";
import { formatNumber, formatPeriod } from "../lib/format";
import { DECISION_LABEL } from "../lib/labels";
import { useComplaintData } from "../state/complaintData";
import { useSession } from "../state/session";
import type { CandidateDecision } from "../types";

const FILTERS: Array<{ id: "all" | CandidateDecision; label: string }> = [
  { id: "all", label: "전체" },
  { id: "pending", label: "승인 대기" },
  { id: "approved", label: "승인" },
  { id: "held", label: "보류" },
  { id: "merged", label: "기존에 합침" },
];
const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export function CandidatesPage() {
  const { candidates, categories, categoryById, decideCandidate, loading, error } = useComplaintData();
  const { user } = useSession();
  const canManage = user?.role === "admin" || user === null;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const visible = candidates.filter((item) => filter === "all" || item.decision === filter);

  const decide = async (id: string, decision: CandidateDecision, mergedIntoId?: string) => {
    try {
      await decideCandidate(id, decision, mergedIntoId);
      setActionError(null);
    } catch (decisionError) {
      setActionError(decisionError instanceof Error ? decisionError.message : "후보 결정을 저장하지 못했습니다.");
    }
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow={formatPeriod(candidates[0]?.period ?? CURRENT_PERIOD)}
        title="신규 후보"
        lede="미배정 민원 중 같은 군집이 5건 이상이거나 두 달 연속 등장한 유형입니다. 승인하면 다음 체계 버전에 들어갑니다."
      />
      <CategoryTabs />
      {loading ? <p className="notice">후보 데이터를 불러오는 중입니다.</p> : null}
      {error || actionError ? <p className="feedback feedback-error" role="alert">{actionError ?? error}</p> : null}
      <div className="filter-bar" aria-label="후보 상태">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "chip-btn is-active" : "chip-btn"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="empty">이 상태의 후보가 없습니다.</p> : null}
      <div className="stack">
        {visible.map((candidate) => {
          const decision = candidate.decision;
          const mergedName = categoryById(candidate.mergedIntoCategoryId ?? mergeTarget[candidate.id] ?? null)?.name;
          return (
            <article className="card" key={candidate.id}>
              <div className="card-head">
                <div>
                  <p className="caption">
                    {candidate.suggestedGroup} · {formatNumber(candidate.size)}건
                  </p>
                  <h2 className="title-md">{candidate.suggestedName}</h2>
                </div>
                <span className={decision === "pending" ? "pill pill-pending" : "pill"}>
                  {DECISION_LABEL[decision]}
                </span>
              </div>
              <p className="body">{candidate.suggestedDefinition}</p>
              <div className="chips notice">
                {candidate.keywords.map((keyword) => (
                  <span className="chip" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
              {candidate.exemplars.map((text) => (
                <p className="quote" key={text}>
                  {text}
                </p>
              ))}
              {decision === "pending" && canManage ? (
                <div className="action-row notice">
                  <Button onClick={() => void decide(candidate.id, "approved")}>승인</Button>
                  <Button variant="secondary" onClick={() => void decide(candidate.id, "held")}>
                    보류
                  </Button>
                  <label className="field field-merge">
                    <span>기존 카테고리</span>
                    <select
                      className="select"
                      value={mergeTarget[candidate.id] ?? categories[0]?.categoryId}
                      onChange={(event) =>
                        setMergeTarget((current) => ({ ...current, [candidate.id]: event.target.value }))
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void decide(
                        candidate.id,
                        "merged",
                        mergeTarget[candidate.id] ?? categories[0]?.categoryId,
                      )
                    }
                  >
                    합치기
                  </Button>
                </div>
              ) : null}
              {decision === "pending" && !canManage ? <p className="notice">관리자만 후보를 결정할 수 있습니다.</p> : null}
              {decision === "merged" && mergedName ? <p className="notice">합친 대상: {mergedName}</p> : null}
              {decision !== "pending" && candidate.decidedBy ? (
                <p className="caption">결정자: {candidate.decidedBy}{candidate.decidedAt ? ` · ${candidate.decidedAt}` : ""}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
