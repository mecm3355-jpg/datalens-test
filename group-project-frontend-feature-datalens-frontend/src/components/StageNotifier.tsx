import { useEffect, useRef } from "react";
import { loadJob } from "../lib/remote";
import { autoAnalysisExpected, phaseOf, stageNotice, type Phase } from "../lib/stages";
import { useCatalog } from "../state/catalog";
import { useNotices } from "../state/notices";
import type { DataFile, Job } from "../types";

// 진단이 끝난 뒤 서버가 민원 분석을 등록하기까지(매핑 추천 등) 걸리는 시간을 넉넉히 기다린다.
// 그 안에 분석이 시작되지 않으면 "자동 분석을 하지 않았다"고 알린다
export const AUTO_START_WAIT_MS = 20_000;

type Seen = { jobId: string | null; phase: Phase | null };

/**
 * 파일 처리 단계가 바뀔 때마다 안내 팝업을 띄웁니다. 화면을 처음 열 때의 상태는 기준으로만 삼고,
 * 그 뒤에 바뀐 단계(새로 올린 파일 포함)만 알립니다. 화면 요소는 그리지 않습니다.
 */
export function StageNotifier() {
  const { files, complaintsByFile, candidates, status } = useCatalog();
  const { notify } = useNotices();
  const seen = useRef(new Map<string, Seen>());
  const jobs = useRef(new Map<string, Job>());
  const ready = useRef(false);
  const waits = useRef(new Map<string, number>());
  // 기다린 뒤 판단할 때 최신 파일 상태를 보려고 둔다
  const latest = useRef<DataFile[]>(files);
  latest.current = files;

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    const pending = candidates.filter((item) => item.decision === "pending").length;

    const jobOf = async (file: DataFile): Promise<Job | null> => {
      if (!file.lastJobId) return null;
      const cached = jobs.current.get(file.lastJobId);
      // 끝난 작업은 바뀌지 않으므로 다시 읽지 않는다. 진행 중이던 작업은 상태가 바뀌었을 수 있다
      if (cached && (cached.status === "completed" || cached.status === "failed") && cached.status === file.status) {
        return cached;
      }
      const job = await loadJob(file.lastJobId).catch(() => null);
      if (job) jobs.current.set(job.id, job);
      return job;
    };

    const announce = (file: DataFile, phase: Phase, job: Job | null) => {
      notify(
        stageNotice(file, phase, {
          complaintCount: complaintsByFile(file.id).length,
          pendingCandidates: pending,
          error: job?.error?.message ?? null,
        }),
      );
    };

    void (async () => {
      for (const file of files) {
        const job = await jobOf(file);
        if (cancelled) return;
        const phase = phaseOf(file.status, job?.type ?? null);
        const before = seen.current.get(file.id);
        seen.current.set(file.id, { jobId: file.lastJobId ?? null, phase });
        // 처음 불러온 목록은 기준으로만 삼는다(새로고침할 때마다 팝업이 쏟아지지 않게)
        if (!ready.current || phase === null) continue;
        if (before && before.phase === phase && before.jobId === (file.lastJobId ?? null)) continue;

        const timer = waits.current.get(file.id);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          waits.current.delete(file.id);
        }
        if (phase === "diagnosed" && autoAnalysisExpected(file.fileCategory)) {
          // 곧 민원 분석이 이어질 수 있으므로 바로 "멈췄다"고 하지 않고 기다렸다가 다시 본다
          const jobId = file.lastJobId;
          waits.current.set(
            file.id,
            window.setTimeout(() => {
              waits.current.delete(file.id);
              const now = latest.current.find((item) => item.id === file.id);
              if (now && now.lastJobId === jobId && now.status === "completed") announce(now, "diagnosed", job);
            }, AUTO_START_WAIT_MS),
          );
          continue;
        }
        announce(file, phase, job);
      }
      ready.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [files, complaintsByFile, candidates, status, notify]);

  useEffect(() => {
    const timers = waits.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
