import { useEffect, useState } from "react";
import { loadJob, loadQuality } from "../lib/remote";
import { AUTO_START_WAIT_MS, isFinished, nextStep } from "../lib/stages";
import { useCatalog } from "../state/catalog";
import { useProgress } from "../state/progress";

/**
 * 진행 팝업에 올린 파일들의 단계를 서버 상태로 갱신합니다. 화면 요소는 그리지 않습니다.
 * 목록이 새로고침될 때마다(처리 중에는 1.5초마다) 마지막 작업을 읽어 단계와 진행률을 바꿉니다.
 */
export function ProgressWatcher() {
  const { files, complaintsByFile, candidates, hasSource, readScanned } = useCatalog();
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
        // 글자 읽기 중인 항목은 catalog.readScanned가 직접 단계를 바꾼다
        if (item.fileId === null || isFinished(item.step) || item.step === "ocr") continue;
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
        // PDF 진단이 끝났는데 분석으로 안 넘어가면, 글자 없는 스캔본인지 한 번 확인한다.
        // 스캔본은 서버가 글자를 못 읽으므로 기다리지 않고 바로 브라우저 글자 읽기로 넘긴다
        const diagnosedOnly = result.waitingSince !== null || result.step === "stopped";
        if (diagnosedOnly && !item.scanChecked && file.extension.toLowerCase() === "pdf") {
          const issues = await loadQuality(file.id).catch(() => []);
          if (cancelled) return;
          const scanned = issues.some((issue) => issue.type === "no_text_layer");
          if (scanned && hasSource(file.id)) {
            update(item.key, { scanned: true, scanChecked: true, step: "ocr", waitingSince: null, detail: "" });
            void readScanned(item.key, file.id);
            continue;
          }
          if (scanned) {
            update(item.key, {
              scanned: true,
              scanChecked: true,
              step: "stopped",
              waitingSince: null,
              detail: "글자 없는 스캔본입니다. 파일 화면에서 원본 PDF를 다시 고르면 이 브라우저에서 읽어 분석합니다.",
            });
            continue;
          }
          update(item.key, { scanChecked: true });
        }
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
  }, [files, items, complaintsByFile, candidates, hasSource, readScanned, update, tick]);

  return null;
}
