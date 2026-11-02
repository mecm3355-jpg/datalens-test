import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isFinished, STEP_DETAIL, STEP_LABEL, stepsFor, type Step } from "../lib/stages";

/** 진행 팝업에서 따라가는 파일 한 개. */
export type ProgressItem = {
  key: string;
  name: string;
  fileId: string | null;
  step: Step;
  detail: string;
  // 작업 진행률(0~100). 서버가 알려 준 값이 없으면 null
  percent: number | null;
  // 다시 분석할 때 이전 작업은 이번 진행으로 보지 않는다
  ignoreJobId: string | null;
  // 진단이 끝나 자동 분석을 기다리기 시작한 시각
  waitingSince: number | null;
  // 글자 없는 스캔본이라 브라우저 글자 읽기 단계를 거치는지
  scanned: boolean;
  // 스캔본인지 서버 진단 결과로 이미 확인했는지(한 번만 확인)
  scanChecked: boolean;
  // 서버가 자동 분석을 시작하지 않을 때 화면이 직접 요청할 나누기 규칙(스캔본 글자 파일)
  fallbackSplitRule: string | null;
};

/** 버튼 없이 잠깐 보였다 사라지는 완료 안내(후보 승인 등). */
export type Flash = { title: string; message: string; tone: "success" | "info" | "error" };

type ProgressValue = {
  items: ProgressItem[];
  // 파일들을 진행 팝업에 올린다. 파일마다 키를 돌려준다
  begin: (
    entries: Array<{ name: string; fileId?: string; step?: Step; ignoreJobId?: string | null; scanned?: boolean }>,
  ) => string[];
  update: (key: string, patch: Partial<Omit<ProgressItem, "key">>) => void;
  flash: (flash: Flash) => void;
};

// 모두 끝난 뒤 결과를 보여 주고 팝업을 닫기까지의 시간
export const CLOSE_AFTER_MS = 3_000;
// 멈추거나 실패한 파일이 있으면 이유를 읽을 수 있게 더 오래 보여 준다
export const CLOSE_AFTER_PROBLEM_MS = 8_000;
// 완료 안내가 떠 있는 시간
export const FLASH_MS = 2_500;

const ProgressContext = createContext<ProgressValue | null>(null);

/** 파일 처리 진행 팝업과 완료 안내를 관리합니다. 둘 다 버튼 없이 스스로 닫힙니다. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const nextKey = useRef(1);

  const begin = useCallback<ProgressValue["begin"]>((entries) => {
    const added = entries.map((entry) => {
      const key = `p${nextKey.current}`;
      nextKey.current += 1;
      return {
        key,
        name: entry.name,
        fileId: entry.fileId ?? null,
        step: entry.step ?? "uploading",
        detail: "",
        percent: null,
        ignoreJobId: entry.ignoreJobId ?? null,
        waitingSince: null,
        scanned: entry.scanned ?? false,
        scanChecked: entry.scanned ?? false,
        fallbackSplitRule: null,
      };
    });
    // 이미 끝난 항목이 남아 있으면 새 진행과 섞이지 않게 비우고 시작한다
    setItems((current) => [...(current.every((item) => isFinished(item.step)) ? [] : current), ...added]);
    return added.map((item) => item.key);
  }, []);

  const update = useCallback<ProgressValue["update"]>((key, patch) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const flash = useCallback((next: Flash) => setFlashes((current) => [...current, next]), []);

  // 모두 끝나면 결과를 잠깐 보여 준 뒤 팝업을 닫는다
  const allFinished = items.length > 0 && items.every((item) => isFinished(item.step));
  const problem = items.some((item) => item.step === "stopped" || item.step === "failed");
  useEffect(() => {
    if (!allFinished) return;
    const timer = window.setTimeout(() => setItems([]), problem ? CLOSE_AFTER_PROBLEM_MS : CLOSE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [allFinished, problem]);

  // 완료 안내는 하나씩 잠깐 보여 준다. 진행 팝업이 떠 있으면 그것이 끝난 뒤에 보여 준다
  const showingFlash = items.length === 0 ? (flashes[0] ?? null) : null;
  useEffect(() => {
    if (!showingFlash) return;
    const timer = window.setTimeout(() => setFlashes((current) => current.slice(1)), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [showingFlash]);

  const value = useMemo(() => ({ items, begin, update, flash }), [items, begin, update, flash]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
      {items.length > 0 ? <ProgressDialog items={items} /> : null}
      {showingFlash ? <FlashDialog flash={showingFlash} /> : null}
    </ProgressContext.Provider>
  );
}

/** 파일마다 단계 표시줄과 현재 하는 일을 보여 주는 팝업. */
function ProgressDialog({ items }: { items: ProgressItem[] }) {
  const finished = items.filter((item) => isFinished(item.step)).length;
  const title = finished === items.length ? "처리를 마쳤습니다" : `파일 처리 중 (${finished}/${items.length} 완료)`;
  return (
    <div className="notice-backdrop">
      <div className="notice-dialog progress-dialog" role="dialog" aria-modal="true" aria-labelledby="progress-title">
        <h2 id="progress-title" className="notice-title">
          {title}
        </h2>
        <ul className="progress-files" aria-live="polite">
          {items.map((item) => (
            <ProgressRow key={item.key} item={item} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 파일 한 개의 진행 상태: 이름, 단계 표시줄, 설명. */
function ProgressRow({ item }: { item: ProgressItem }) {
  const steps = stepsFor(item.scanned);
  const reached = steps.findIndex((step) => step === item.step);
  const detail =
    item.detail ||
    (item.step === "uploading" || item.step === "diagnosing" || item.step === "ocr" || item.step === "analyzing"
      ? STEP_DETAIL[item.step]
      : "");
  return (
    <li className={`progress-file progress-${item.step}`}>
      <p className="progress-name">{item.name}</p>
      <ol className="progress-steps" aria-label="처리 단계" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {steps.map((step, index) => {
          const state = index < reached || item.step === "done" ? "done" : index === reached ? "current" : "todo";
          return (
            <li key={step} className={`progress-step progress-step-${state}`} aria-current={state === "current" ? "step" : undefined}>
              {STEP_LABEL[step]}
              {state === "current" && item.percent !== null ? ` ${item.percent}%` : ""}
            </li>
          );
        })}
      </ol>
      <p className={item.step === "failed" ? "progress-detail feedback-error" : "progress-detail"}>
        {item.step === "stopped" || item.step === "failed" ? `${STEP_LABEL[item.step]}: ` : ""}
        {detail}
      </p>
    </li>
  );
}

/** 잠깐 보였다 사라지는 완료 안내. */
function FlashDialog({ flash }: { flash: Flash }) {
  return (
    <div className="notice-backdrop">
      <div className={`notice-dialog notice-${flash.tone}`} role="status" aria-live="polite">
        <h2 className="notice-title">{flash.title}</h2>
        <p className="notice-body">{flash.message}</p>
      </div>
    </div>
  );
}

export function useProgress(): ProgressValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("ProgressProvider가 필요합니다.");
  return value;
}
