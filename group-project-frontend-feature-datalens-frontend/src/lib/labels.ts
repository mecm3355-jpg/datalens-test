import type { AssignStatus, CandidateDecision, FileStatus, ReviewReason } from "../types";

export const ASSIGN_LABEL: Record<AssignStatus, string> = {
  auto: "자동 배정",
  ambiguous: "애매",
  unassigned: "미배정",
  confirmed: "사람 확정",
};

export const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  queued: "대기",
  processing: "처리 중",
  completed: "완료",
  failed: "실패",
};

export const DECISION_LABEL: Record<CandidateDecision, string> = {
  pending: "승인 대기",
  approved: "승인",
  held: "보류",
  merged: "기존에 합침",
};

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  ambiguous: "애매한 배정",
  urgent: "긴급",
  attributeUncertain: "속성 불확실",
};

export const SEVERITY_LABEL = {
  high: "높음",
  medium: "중간",
  low: "낮음",
} as const;

export const MAPPING_FIELDS = [
  { id: "content", label: "민원 내용" },
  { id: "receivedAt", label: "접수일시" },
  { id: "region", label: "지역" },
  { id: "longitude", label: "경도" },
  { id: "latitude", label: "위도" },
  { id: "agency", label: "처리기관" },
  { id: "sourceId", label: "원본 ID" },
  { id: "ignore", label: "사용 안 함" },
] as const;

export const FILE_CATEGORY_LABEL = {
  tabular: "표",
  text: "텍스트",
  image: "이미지",
  document: "문서",
  other: "기타",
} as const;
