import { useEffect, useState } from "react";
import { loadJob } from "../lib/remote";
import { AUTO_START_WAIT_MS, isFinished, nextStep } from "../lib/stages";
import { useCatalog } from "../state/catalog";
import { useProgress } from "../state/progress";

/**
 * 진행 팝업에 올린 파일들의 단계를 서버 상태로 갱신합니다. 화면 요소는 그리지 않습니다.
 * 목록이 새로고침될 때마다(처리 중에는 1.5초마다) 마지막 작업을 읽어 단계와 진행률을 바꿉니다.
 */
export function ProgressWatcher() {
  const { files, complaintsByFile, candidates } = useCatalog();
  const { items, update } = useProgress();
  // 진단 뒤 자동 분석을 기다리는 동안 목록이 그대로여도 다시 판단하도록 깨운다
  const [tick, setTick] = useState(0);
  const waiting = items.some((item) => item.waitingSince !== null && !isFinished(item.step));

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), AUTO_START_WAIT_MS / 3);
    return () => window.clearTimeout(timer);
  }, [waiting, tick]);

  useEffect(() => {
    let cancelled = false;
    const pending = candidates.filter((item) => item.decision === "pending").length;
    void (async () => {
      for (const item of items) {
        if (item.fileId === null || isFinished(item.step)) continue;
        const file = files.find((entry) => entry.id === item.fileId);
        // 업로드 직후 목록에 아직 없으면 다음 새로고침을 기다린다
        if (!file) continue;
        const jobId = file.lastJobId ?? null;
        const job = jobId && jobId !== item.ignoreJobId ? await loadJob(jobId).catch(() => null) : null;
        if (cancelled) return;
        const result = nextStep(
          {
            status: job?.status ?? file.status,
            jobId,
            jobType: job?.type ?? null,
            jobError: job?.error?.message ?? null,
            fileCategory: file.fileCategory,
            complaintCount: complaintsByFile(file.id).length,
            pendingCandidates: pending,
          },
          item.ignoreJobId,
          item.waitingSince,
          Date.now(),
        );
        const percent = job && !isFinished(result.step) && job.progress > 0 ? job.progress : null;
        if (
          result.step !== item.step ||
          result.detail !== item.detail ||
          result.waitingSince !== item.waitingSince ||
          percent !== item.percent
        ) {
          update(item.key, { ...result, percent });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, items, complaintsByFile, candidates, update, tick]);

  return null;
}
