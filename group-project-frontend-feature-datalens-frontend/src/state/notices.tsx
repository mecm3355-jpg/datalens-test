import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { StageNotice } from "../lib/stages";

type NoticeValue = {
  // 안내 팝업을 띄운다. 이미 떠 있으면 닫힌 뒤 차례로 띄운다
  notify: (notice: StageNotice) => void;
};

type QueuedNotice = StageNotice & { id: number };

const NoticeContext = createContext<NoticeValue | null>(null);

/** 단계 안내 팝업을 한 번에 하나씩 띄웁니다. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotice[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((notice: StageNotice) => {
    const id = nextId.current;
    nextId.current += 1;
    setQueue((current) => [...current, { ...notice, id }]);
  }, []);
  const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);

  const value = useMemo(() => ({ notify }), [notify]);
  const current = queue[0] ?? null;

  return (
    <NoticeContext.Provider value={value}>
      {children}
      {current ? <NoticeDialog key={current.id} notice={current} remaining={queue.length - 1} onClose={dismiss} /> : null}
    </NoticeContext.Provider>
  );
}

/** 안내 팝업 하나. Esc나 확인으로 닫고, 다음 할 일 버튼은 그 화면으로 이동한 뒤 닫는다. */
function NoticeDialog({ notice, remaining, onClose }: { notice: QueuedNotice; remaining: number; onClose: () => void }) {
  const navigate = useNavigate();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 키보드 사용자가 바로 닫거나 다음 할 일로 갈 수 있게 버튼에 초점을 둔다
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="notice-backdrop">
      <div
        className={`notice-dialog notice-${notice.tone}`}
        role={notice.tone === "error" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`notice-title-${notice.id}`}
        aria-describedby={`notice-body-${notice.id}`}
      >
        <h2 id={`notice-title-${notice.id}`} className="notice-title">
          {notice.title}
        </h2>
        <p id={`notice-body-${notice.id}`} className="notice-body">
          {notice.message}
        </p>
        {remaining > 0 ? <p className="caption">안내 {remaining}개가 더 있습니다.</p> : null}
        <div className="notice-actions">
          {notice.link ? (
            <button
              type="button"
              className="btn btn-primary"
              ref={confirmRef}
              onClick={() => {
                if (notice.link) navigate(notice.link.to);
                onClose();
              }}
            >
              {notice.link.label}
            </button>
          ) : null}
          <button
            type="button"
            className={notice.link ? "btn btn-secondary" : "btn btn-primary"}
            ref={notice.link ? undefined : confirmRef}
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export function useNotices(): NoticeValue {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("NoticeProvider가 필요합니다.");
  return value;
}
