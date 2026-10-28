export type AssignStatus = "auto" | "ambiguous" | "unassigned" | "confirmed";

export type Urgency = "긴급" | "높음" | "보통" | "낮음";

export type RepeatFlag = "최초" | "재신고";

export type RequestType = "수리·조치" | "단속" | "신설·개선" | "질의" | "불만";

export type Affected = "어린이" | "노인" | "장애인" | "일반";

export type ReviewReason = "ambiguous" | "urgent" | "attributeUncertain";

export type FileStatus = "queued" | "processing" | "completed" | "failed";

export type FileCategory = "tabular" | "text" | "image" | "document" | "other";

export type JobStatus = FileStatus;

export type CandidateDecision = "pending" | "approved" | "held" | "merged";

export type MappingType = "merge" | "split";

export type CleaningDecision = "pending" | "approved" | "rejected";

export type CleaningRule = {
  id: string;
  name: string;
  description: string;
  affectedRows: number;
  severity: "recommended" | "required";
};

export type CleaningPreviewRow = {
  id: string;
  row: number;
  field: string;
  before: string;
  after: string;
  ruleId: string;
};

export type MappingField =
  | "content"
  | "receivedAt"
  | "region"
  | "longitude"
  | "latitude"
  | "agency"
  | "sourceId"
  | "ignore";

export type Category = {
  categoryId: string;
  name: string;
  group: string;
  definition: string;
  keywords: string[];
  count: number;
  previousCount: number;
  createdInVersion: number;
};

export type Attributes = {
  facility: string | null;
  place: string | null;
  urgency: Urgency | null;
  repeat: RepeatFlag | null;
  requestType: RequestType | null;
  affected: Affected | null;
};

export type Complaint = {
  id: string;
  fileId: string;
  receivedAt: string;
  period: string;
  region: string | null;
  contentMasked: string;
  contentType: "body" | "title";
  sourceCategory: string | null;
  categoryId: string | null;
  group: string | null;
  taxonomyVersion: number;
  assignStatus: AssignStatus;
  similarity: number | null;
  runnerUpCategoryId: string | null;
  candidateId: string | null;
  attributes: Attributes;
  needsReview: boolean;
  reviewReason: ReviewReason | null;
  issueId: string | null;
  sourceLocator: { row?: number; page?: number; block?: number };
  analyzer: string;
};

export type Issue = {
  id: string;
  categoryId: string;
  place: string;
  region: string;
  complaintCount: number;
  firstReceivedAt: string;
  lastReceivedAt: string;
  summary: string;
  maxUrgency: Urgency;
  status: "open" | "resolved";
};

export type Candidate = {
  id: string;
  period: string;
  size: number;
  keywords: string[];
  suggestedName: string;
  suggestedDefinition: string;
  suggestedGroup: string;
  decision: CandidateDecision;
  exemplars: string[];
};

export type ReviewItem = {
  id: string;
  complaintId: string;
  reason: ReviewReason;
  suggestedCategoryId: string | null;
  status: "pending" | "done";
};

export type DataFile = {
  id: string;
  originalName: string;
  extension: string;
  fileCategory: FileCategory;
  sizeBytes: number;
  status: FileStatus;
  createdAt: string;
  rowCount: number | null;
  columns: string[];
  mapping: Partial<Record<string, MappingField>>;
  swappedAxes?: boolean;
};

export type Job = {
  id: string;
  fileId: string;
  type: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error: { code: string; message: string } | null;
};

export type QualityIssue = {
  type: string;
  severity: "high" | "medium" | "low";
  count: number;
  location: string | null;
  message: string;
};

export type Mapping = {
  id: string;
  type: MappingType;
  fromCategoryId: string;
  toCategoryId: string;
  fromName: string;
  toName: string;
  fromVersion: number;
  toVersion: number;
  reason: string | null;
  createdAt: string;
};

export type MonthlyPoint = {
  period: string;
  count: number;
};

export type RegionCount = {
  name: string;
  count: number;
};

export type UrgencyCount = {
  urgency: Urgency;
  count: number;
};

export type HealthPoint = {
  period: string;
  unassigned: number;
  ambiguous: number;
};

export type Stage = {
  id: string;
  label: string;
};
