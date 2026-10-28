import { useState } from "react";
import { Button } from "../components/Button";
import { CategoryTabs } from "../components/CategoryTabs";
import { PageIntro } from "../components/PageIntro";
import { candidates, categories, categoryById, CURRENT_PERIOD } from "../data/mock";
import { formatNumber, formatPeriod } from "../lib/format";
import { DECISION_LABEL } from "../lib/labels";
import { useWorkspace } from "../state/workspace";
import type { CandidateDecision } from "../types";

const FILTERS: Array<{ id: "all" | CandidateDecision; label: string }> = [
  { id: "all", label: "전체" },
  { id: "pending", label: "승인 대기" },
  { id: "approved", label: "승인" },
  { id: "held", label: "보류" },
  { id: "merged", label: "기존에 합침" },
];

export function CandidatesPage() {
  const workspace = useWorkspace();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const visible = candidates.filter((item) => filter === "all" || workspace.candidateDecision(item.id) === filter);

  return (
    <div className="page">
      <PageIntro
        eyebrow={formatPeriod(CURRENT_PERIOD)}
        title="신규 후보"
        lede="미배정 민원 중 같은 군집이 5건 이상이거나 두 달 연속 등장한 유형입니다. 승인하면 다음 체계 버전에 들어갑니다."
      />
      <CategoryTabs />
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
          const decision = workspace.candidateDecision(candidate.id);
          const mergedId = workspace.mergedInto(candidate.id);
          const mergedName = categoryById(mergedId)?.name;
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
              {decision === "pending" ? (
                <div className="action-row notice">
                  <Button onClick={() => workspace.decideCandidate(candidate.id, "approved")}>승인</Button>
                  <Button variant="secondary" onClick={() => workspace.decideCandidate(candidate.id, "held")}>
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
                      workspace.decideCandidate(
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
              {decision === "merged" && mergedName ? <p className="notice">합친 대상: {mergedName}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
