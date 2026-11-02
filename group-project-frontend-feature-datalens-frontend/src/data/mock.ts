import type {
  Candidate,
  Category,
  Complaint,
  DataFile,
  HealthPoint,
  Issue,
  Job,
  Mapping,
  MonthlyPoint,
  QualityIssue,
  RegionCount,
  ReviewItem,
  Stage,
  UrgencyCount,
} from "../types";

export const CURRENT_PERIOD = "2026-10";
export const TAXONOMY_VERSION = 3;
export const PREVIOUS_TOTAL = 1106;

export const assignmentSummary = {
  total: 1284,
  auto: 1002,
  ambiguous: 86,
  unassigned: 142,
  confirmed: 54,
};

export const stages: Stage[] = [
  { id: "validating", label: "형식 검증" },
  { id: "parsing", label: "추출" },
  { id: "masking", label: "마스킹" },
  { id: "embedding", label: "임베딩" },
  { id: "assigning", label: "배정" },
  { id: "discovering", label: "발견" },
  { id: "issue_grouping", label: "이슈 묶기" },
  { id: "statistics", label: "집계" },
  { id: "ai_summary", label: "요약" },
];

export const categories: Category[] = [
  {
    categoryId: "CAT-0021",
    name: "불법 주정차",
    group: "교통·주정차",
    definition: "도로·인도·소화전 주변의 불법 주정차. 어린이보호구역 단속 요청 포함",
    keywords: ["주정차", "인도", "소화전", "과태료"],
    count: 210,
    previousCount: 176,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0022",
    name: "횡단보도 주정차",
    group: "교통·주정차",
    definition: "횡단보도와 모퉁이에 멈춰 통행을 막는 차량",
    keywords: ["횡단보도", "모퉁이", "통행", "어린이"],
    count: 102,
    previousCount: 98,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0030",
    name: "도로 파손",
    group: "도로·보행",
    definition: "차도 포트홀·침하. 보도 파손은 제외",
    keywords: ["포트홀", "침하", "차도", "균열"],
    count: 74,
    previousCount: 69,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0031",
    name: "보도블록 파손",
    group: "도로·보행",
    definition: "보도블록·점자블록이 깨지거나 들뜬 경우",
    keywords: ["보도블록", "점자블록", "들뜸", "보행"],
    count: 112,
    previousCount: 80,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0012",
    name: "가로등 고장",
    group: "안전·조명",
    definition: "가로등·보안등이 꺼지거나 깜빡임. 설치 요청은 제외",
    keywords: ["가로등", "깜빡", "꺼짐", "어두움"],
    count: 96,
    previousCount: 88,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0018",
    name: "보안등 고장",
    group: "안전·조명",
    definition: "골목·공원 보안등이 꺼진 경우. 가로등 본주는 제외",
    keywords: ["보안등", "골목", "공원", "소등"],
    count: 68,
    previousCount: 70,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0040",
    name: "쓰레기 무단투기",
    group: "환경·청소",
    definition: "도로·공터에 버린 생활폐기물과 청소 요청",
    keywords: ["쓰레기", "투기", "청소", "악취"],
    count: 90,
    previousCount: 84,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0044",
    name: "불법 현수막·광고물",
    group: "환경·청소",
    definition: "도로·가로수에 무단으로 걸린 현수막·전단",
    keywords: ["현수막", "불법", "가로수", "광고물"],
    count: 38,
    previousCount: 0,
    createdInVersion: 3,
  },
  {
    categoryId: "CAT-0070",
    name: "층간·공사 소음",
    group: "소음·건축·주거",
    definition: "공사·심야 작업으로 반복되는 소음과 진동",
    keywords: ["소음", "공사", "진동", "심야"],
    count: 58,
    previousCount: 22,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0074",
    name: "건축 분진",
    group: "소음·건축·주거",
    definition: "공사장 분진·세륜 미흡. 소음만 있는 민원은 제외",
    keywords: ["분진", "공사장", "세륜", "먼지"],
    count: 22,
    previousCount: 20,
    createdInVersion: 2,
  },
  {
    categoryId: "CAT-0050",
    name: "배수 불량",
    group: "물·하천",
    definition: "빗물받이·지하차도 배수가 막혀 침수 위험이 있는 경우",
    keywords: ["배수", "침수", "빗물받이", "지하차도"],
    count: 44,
    previousCount: 20,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0055",
    name: "하천 악취",
    group: "물·하천",
    definition: "하천·복개천의 악취와 부유물",
    keywords: ["하천", "악취", "부유물", "오수"],
    count: 30,
    previousCount: 28,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0060",
    name: "놀이터 시설 파손",
    group: "공원·공공시설",
    definition: "놀이터 기구가 부러지거나 고정이 풀린 경우",
    keywords: ["놀이터", "기구", "어린이", "파손"],
    count: 36,
    previousCount: 33,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0062",
    name: "공원 벤치 파손",
    group: "공원·공공시설",
    definition: "공원 벤치·펜스 파손. 놀이 기구는 제외",
    keywords: ["벤치", "펜스", "공원", "파손"],
    count: 26,
    previousCount: 24,
    createdInVersion: 2,
  },
  {
    categoryId: "CAT-0080",
    name: "법령 해석 질의",
    group: "행정·법령 질의",
    definition: "법령·인허가 해석을 묻는 질의. 현장 보수는 제외",
    keywords: ["법령", "해석", "인허가", "질의"],
    count: 31,
    previousCount: 29,
    createdInVersion: 1,
  },
  {
    categoryId: "CAT-0082",
    name: "처리 경과 문의",
    group: "행정·법령 질의",
    definition: "이미 접수한 민원의 처리 부서와 경과를 묻는 경우",
    keywords: ["경과", "처리", "부서", "회신"],
    count: 19,
    previousCount: 18,
    createdInVersion: 2,
  },
];

export const issues: Issue[] = [
  {
    id: "ISS-01",
    categoryId: "CAT-0022",
    place: "수청동 어린이보호구역 횡단보도",
    region: "수청동",
    complaintCount: 11,
    firstReceivedAt: "2026-08-03",
    lastReceivedAt: "2026-10-22",
    summary: "수청초등학교 앞 횡단보도에 차량이 반복해서 멈춰 있습니다.",
    maxUrgency: "높음",
    status: "open",
  },
  {
    id: "ISS-02",
    categoryId: "CAT-0012",
    place: "수청동 놀이터 옆",
    region: "수청동",
    complaintCount: 6,
    firstReceivedAt: "2026-07-14",
    lastReceivedAt: "2026-10-18",
    summary: "수청동 놀이터 옆 가로등이 밤마다 깜빡입니다.",
    maxUrgency: "보통",
    status: "open",
  },
  {
    id: "ISS-04",
    categoryId: "CAT-0050",
    place: "해도동 지하차도",
    region: "해도동",
    complaintCount: 5,
    firstReceivedAt: "2026-09-02",
    lastReceivedAt: "2026-10-21",
    summary: "해도동 지하차도 빗물받이가 막혀 차선이 잠깁니다.",
    maxUrgency: "긴급",
    status: "open",
  },
  {
    id: "ISS-03",
    categoryId: "CAT-0031",
    place: "대잠동 시장 앞 보도",
    region: "대잠동",
    complaintCount: 4,
    firstReceivedAt: "2026-06-11",
    lastReceivedAt: "2026-10-09",
    summary: "대잠동 시장 앞 보도블록이 들떠 보행이 위험합니다.",
    maxUrgency: "보통",
    status: "open",
  },
  {
    id: "ISS-05",
    categoryId: "CAT-0070",
    place: "양덕동 재개발 현장",
    region: "양덕동",
    complaintCount: 3,
    firstReceivedAt: "2026-08-19",
    lastReceivedAt: "2026-09-28",
    summary: "양덕동 재개발 현장에서 심야 소음이 반복되었습니다.",
    maxUrgency: "높음",
    status: "resolved",
  },
];

function complaint(
  input: Pick<Complaint, "id" | "fileId" | "receivedAt" | "region" | "contentMasked" | "assignStatus"> &
    Partial<Omit<Complaint, "group" | "taxonomyVersion" | "analyzer" | "period">>,
): Complaint {
  const category = categories.find((item) => item.categoryId === input.categoryId);
  return {
    contentType: "body",
    sourceCategory: null,
    categoryId: null,
    similarity: null,
    runnerUpCategoryId: null,
    candidateId: null,
    attributes: {
      facility: null,
      place: null,
      urgency: null,
      repeat: null,
      requestType: null,
      affected: null,
    },
    needsReview: false,
    reviewReason: null,
    issueId: null,
    sourceLocator: { row: 1 },
    ...input,
    period: input.receivedAt.slice(0, 7),
    group: category?.group ?? null,
    taxonomyVersion: TAXONOMY_VERSION,
    analyzer: "bge-m3@1",
  };
}

export const complaints: Complaint[] = [
  complaint({
    id: "CMP-1001",
    fileId: "file-pohang",
    receivedAt: "2026-10-18",
    region: "수청동",
    contentMasked: "수청동 놀이터 옆 가로등이 밤마다 깜빡입니다.",
    assignStatus: "auto",
    categoryId: "CAT-0012",
    similarity: 0.86,
    runnerUpCategoryId: "CAT-0018",
    attributes: {
      facility: "가로등",
      place: "놀이터 옆",
      urgency: "보통",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "일반",
    },
    issueId: "ISS-02",
    sourceLocator: { row: 12 },
  }),
  complaint({
    id: "CMP-1002",
    fileId: "file-pohang",
    receivedAt: "2026-10-02",
    region: "수청동",
    contentMasked: "지난달에도 신고했는데 수청동 놀이터 옆 가로등이 여전히 꺼집니다.",
    assignStatus: "auto",
    categoryId: "CAT-0012",
    similarity: 0.84,
    attributes: {
      facility: "가로등",
      place: "놀이터 옆",
      urgency: "보통",
      repeat: "재신고",
      requestType: "수리·조치",
      affected: "일반",
    },
    issueId: "ISS-02",
    sourceLocator: { row: 18 },
  }),
  complaint({
    id: "CMP-1003",
    fileId: "file-virtual",
    receivedAt: "2026-10-22",
    region: "수청동",
    contentMasked: "수청초등학교 앞 횡단보도에 차량이 매일 멈춰 어린이 통행을 막습니다.",
    assignStatus: "auto",
    categoryId: "CAT-0022",
    similarity: 0.91,
    attributes: {
      facility: "횡단보도",
      place: "수청초등학교 앞",
      urgency: "높음",
      repeat: "재신고",
      requestType: "단속",
      affected: "어린이",
    },
    issueId: "ISS-01",
    sourceLocator: { row: 44 },
  }),
  complaint({
    id: "CMP-1004",
    fileId: "file-virtual",
    receivedAt: "2026-10-11",
    region: "수청동",
    contentMasked: "같은 어린이보호구역 횡단보도에 학원 차량이 다시 정차했습니다.",
    assignStatus: "confirmed",
    categoryId: "CAT-0022",
    similarity: 0.88,
    attributes: {
      facility: "횡단보도",
      place: "어린이보호구역",
      urgency: "높음",
      repeat: "재신고",
      requestType: "단속",
      affected: "어린이",
    },
    issueId: "ISS-01",
    sourceLocator: { row: 45 },
  }),
  complaint({
    id: "CMP-1005",
    fileId: "file-virtual",
    receivedAt: "2026-10-09",
    region: "대잠동",
    contentMasked: "대잠동 시장 앞 보도블록이 들떠 지팡이를 짚는 분이 넘어질 뻔했습니다.",
    assignStatus: "auto",
    categoryId: "CAT-0031",
    similarity: 0.83,
    attributes: {
      facility: "보도블록",
      place: "시장 앞",
      urgency: "보통",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "노인",
    },
    issueId: "ISS-03",
    sourceLocator: { row: 210 },
  }),
  complaint({
    id: "CMP-1006",
    fileId: "file-virtual",
    receivedAt: "2026-10-21",
    region: "해도동",
    contentMasked: "해도동 지하차도 빗물받이가 막혀 어제 차선이 무릎까지 잠겼습니다.",
    assignStatus: "auto",
    categoryId: "CAT-0050",
    similarity: 0.8,
    attributes: {
      facility: "빗물받이",
      place: "지하차도",
      urgency: "긴급",
      repeat: "재신고",
      requestType: "수리·조치",
      affected: "일반",
    },
    needsReview: true,
    reviewReason: "urgent",
    issueId: "ISS-04",
    sourceLocator: { row: 388 },
  }),
  complaint({
    id: "CMP-1007",
    fileId: "file-virtual",
    receivedAt: "2026-10-16",
    region: "장성동",
    contentMasked: "장성동 아파트 앞 공사가 밤 11시 넘어서도 이어지고 진동이 심합니다.",
    assignStatus: "auto",
    categoryId: "CAT-0070",
    similarity: 0.87,
    attributes: {
      facility: "공사장",
      place: "아파트 앞",
      urgency: "높음",
      repeat: "재신고",
      requestType: "단속",
      affected: "일반",
    },
    sourceLocator: { row: 401 },
  }),
  complaint({
    id: "CMP-1008",
    fileId: "file-ocr",
    receivedAt: "2026-10-20",
    region: null,
    contentMasked: "도로점용 허가 없이 설치된 시설의 원상회복 의무가 어디에 규정되어 있는지 질의합니다.",
    contentType: "title",
    assignStatus: "auto",
    categoryId: "CAT-0080",
    similarity: 0.79,
    attributes: {
      facility: null,
      place: null,
      urgency: "낮음",
      repeat: "최초",
      requestType: "질의",
      affected: "일반",
    },
    sourceLocator: { page: 3, block: 2 },
  }),
  complaint({
    id: "CMP-1009",
    fileId: "file-virtual",
    receivedAt: "2026-10-19",
    region: "상대동",
    contentMasked: "상대동 인도에 공유킥보드가 쓰러진 채 며칠째 통행을 막고 있습니다.",
    assignStatus: "unassigned",
    candidateId: "cand-1",
    attributes: {
      facility: "공유킥보드",
      place: "인도",
      urgency: "보통",
      repeat: "최초",
      requestType: "단속",
      affected: "일반",
    },
    sourceLocator: { row: 512 },
  }),
  complaint({
    id: "CMP-1010",
    fileId: "file-virtual",
    receivedAt: "2026-10-14",
    region: "죽도동",
    contentMasked: "죽도동 버스승강장 앞 바닥이 파여 유모차 바퀴가 빠집니다.",
    assignStatus: "ambiguous",
    categoryId: "CAT-0031",
    similarity: 0.74,
    runnerUpCategoryId: "CAT-0030",
    attributes: {
      facility: "보도",
      place: "버스승강장 앞",
      urgency: "높음",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "일반",
    },
    needsReview: true,
    reviewReason: "ambiguous",
    sourceLocator: { row: 277 },
  }),
  complaint({
    id: "CMP-1011",
    fileId: "file-pohang",
    receivedAt: "2026-10-08",
    region: "장성동",
    contentMasked: "장성동 가로수에 불법 현수막이 여러 장 걸려 신호등이 가립니다.",
    assignStatus: "confirmed",
    categoryId: "CAT-0044",
    similarity: 0.9,
    attributes: {
      facility: "가로수",
      place: "교차로",
      urgency: "보통",
      repeat: "최초",
      requestType: "단속",
      affected: "일반",
    },
    sourceLocator: { row: 40 },
  }),
  complaint({
    id: "CMP-1012",
    fileId: "file-virtual",
    receivedAt: "2026-10-06",
    region: "양덕동",
    contentMasked: "양덕동 놀이터 미끄럼틀 난간이 벌어져 어린이 손이 끼기 직전입니다.",
    assignStatus: "auto",
    categoryId: "CAT-0060",
    similarity: 0.85,
    attributes: {
      facility: "미끄럼틀",
      place: "놀이터",
      urgency: "높음",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "어린이",
    },
    sourceLocator: { row: 640 },
  }),
  complaint({
    id: "CMP-1013",
    fileId: "file-asan",
    receivedAt: "2026-09-18",
    region: "온천동",
    contentMasked: "도로관리 민원. 차도 포트홀 보수를 요청한 처리 현황입니다.",
    contentType: "title",
    sourceCategory: "05.도로관리",
    assignStatus: "auto",
    categoryId: "CAT-0030",
    similarity: 0.77,
    attributes: {
      facility: "차도",
      place: null,
      urgency: "보통",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "일반",
    },
    sourceLocator: { row: 1204 },
  }),
  complaint({
    id: "CMP-1014",
    fileId: "file-virtual",
    receivedAt: "2026-10-13",
    region: "해도동",
    contentMasked: "해도동 골목이 너무 불편합니다. 어디서부터 손봐야 할지 같이 봐 주세요.",
    assignStatus: "ambiguous",
    categoryId: "CAT-0031",
    similarity: 0.71,
    attributes: {
      facility: null,
      place: "골목",
      urgency: "보통",
      repeat: null,
      requestType: null,
      affected: null,
    },
    needsReview: true,
    reviewReason: "attributeUncertain",
    sourceLocator: { row: 701 },
  }),
  complaint({
    id: "CMP-1015",
    fileId: "file-virtual",
    receivedAt: "2026-10-23",
    region: "대잠동",
    contentMasked: "대잠동 점자블록이 중간에 끊겨 시각장애인이 차도로 내려갔습니다.",
    assignStatus: "auto",
    categoryId: "CAT-0031",
    similarity: 0.82,
    attributes: {
      facility: "점자블록",
      place: "버스승강장",
      urgency: "긴급",
      repeat: "최초",
      requestType: "수리·조치",
      affected: "장애인",
    },
    needsReview: true,
    reviewReason: "urgent",
    sourceLocator: { row: 733 },
  }),
];

export const candidates: Candidate[] = [
  {
    id: "cand-1",
    period: CURRENT_PERIOD,
    size: 17,
    keywords: ["킥보드", "인도", "쓰러짐", "통행"],
    suggestedName: "공유킥보드 방치",
    suggestedDefinition: "인도·횡단보도에 쓰러지거나 통행을 막는 공유킥보드",
    suggestedGroup: "교통·주정차",
    decision: "pending",
    exemplars: [
      "상대동 인도에 공유킥보드가 쓰러진 채 며칠째 통행을 막고 있습니다.",
      "횡단보도 앞에 킥보드 세 대가 신호를 가립니다.",
    ],
  },
  {
    id: "cand-2",
    period: CURRENT_PERIOD,
    size: 9,
    keywords: ["가로수", "뿌리", "보도", "융기"],
    suggestedName: "가로수 뿌리 융기",
    suggestedDefinition: "가로수 뿌리로 보도가 들뜬 경우. 블록 자체 파손은 제외",
    suggestedGroup: "도로·보행",
    decision: "pending",
    exemplars: ["죽도동 가로수 뿌리가 보도블록을 밀어 올려 통행이 어렵습니다."],
  },
  {
    id: "cand-3",
    period: CURRENT_PERIOD,
    size: 6,
    keywords: ["모기", "공원", "해충", "방역"],
    suggestedName: "공원 해충",
    suggestedDefinition: "공원·하천변 모기 등 해충 방역 요청",
    suggestedGroup: "공원·공공시설",
    decision: "pending",
    exemplars: ["중앙공원 산책로에서 해 질 무렵 모기가 심해 산책을 못 합니다."],
  },
  {
    id: "cand-4",
    period: "2026-09",
    size: 7,
    keywords: ["간판", "조명", "점멸", "수면"],
    suggestedName: "옥외 간판 조명",
    suggestedDefinition: "심야에 깜빡이는 옥외 간판 조명",
    suggestedGroup: "소음·건축·주거",
    decision: "held",
    exemplars: ["상대동 상가 간판이 새벽까지 깜빡여 창문이 밝습니다."],
  },
];

export const reviews: ReviewItem[] = [
  {
    id: "REV-01",
    complaintId: "CMP-1010",
    reason: "ambiguous",
    suggestedCategoryId: "CAT-0031",
    status: "pending",
  },
  {
    id: "REV-02",
    complaintId: "CMP-1006",
    reason: "urgent",
    suggestedCategoryId: "CAT-0050",
    status: "pending",
  },
  {
    id: "REV-03",
    complaintId: "CMP-1014",
    reason: "attributeUncertain",
    suggestedCategoryId: "CAT-0031",
    status: "pending",
  },
  {
    id: "REV-04",
    complaintId: "CMP-1015",
    reason: "urgent",
    suggestedCategoryId: "CAT-0031",
    status: "pending",
  },
];

export const files: DataFile[] = [
  {
    id: "file-virtual",
    originalName: "생활불편_가상민원_1000건_날짜재배정.xlsx",
    extension: "xlsx",
    fileCategory: "tabular",
    sizeBytes: 1_840_000,
    status: "completed",
    createdAt: "2026-10-25",
    rowCount: 1000,
    columns: ["민원내용", "접수일시", "지역", "대분류", "세부분류", "긴급도"],
    mapping: {
      민원내용: "content",
      접수일시: "receivedAt",
      지역: "region",
      대분류: "ignore",
      세부분류: "ignore",
      긴급도: "ignore",
    },
  },
  {
    id: "file-pohang",
    originalName: "포항시_불편신고접수_20230828.csv",
    extension: "csv",
    fileCategory: "tabular",
    sizeBytes: 48_200,
    status: "completed",
    createdAt: "2026-10-24",
    rowCount: 113,
    columns: ["번호", "접수일", "신고상담내용", "경도", "위도", "주소"],
    mapping: {
      번호: "sourceId",
      접수일: "receivedAt",
      신고상담내용: "content",
      경도: "longitude",
      위도: "latitude",
      주소: "region",
    },
    swappedAxes: true,
  },
  {
    id: "file-ocr",
    originalName: "국민신문고_OCR_민원제목.csv",
    extension: "csv",
    fileCategory: "tabular",
    sizeBytes: 120_400,
    status: "processing",
    createdAt: "2026-10-25",
    rowCount: 500,
    columns: ["제목", "처리기관", "등록일"],
    mapping: {
      제목: "content",
      처리기관: "agency",
      등록일: "receivedAt",
    },
  },
  {
    id: "file-asan",
    originalName: "아산시_생활민원처리현황_20250901.csv",
    extension: "csv",
    fileCategory: "tabular",
    sizeBytes: 8_400_000,
    status: "queued",
    createdAt: "2026-10-23",
    rowCount: 27909,
    columns: ["접수일시", "민원유형-중", "처리부서", "처리팀"],
    mapping: {
      접수일시: "receivedAt",
      "민원유형-중": "ignore",
      처리부서: "agency",
      처리팀: "ignore",
    },
  },
  {
    id: "file-fail",
    originalName: "스캔본_민원묶음.hwpx",
    extension: "hwpx",
    fileCategory: "document",
    sizeBytes: 220_400,
    status: "failed",
    createdAt: "2026-10-22",
    rowCount: null,
    columns: [],
    mapping: {},
  },
];

export const jobs: Job[] = [
  {
    id: "job-virtual",
    fileId: "file-virtual",
    type: "complaint_analysis",
    status: "completed",
    progress: 100,
    stage: "ai_summary",
    error: null,
  },
  {
    id: "job-pohang",
    fileId: "file-pohang",
    type: "complaint_analysis",
    status: "completed",
    progress: 100,
    stage: "ai_summary",
    error: null,
  },
  {
    id: "job-ocr",
    fileId: "file-ocr",
    type: "complaint_analysis",
    status: "processing",
    progress: 46,
    stage: "embedding",
    error: null,
  },
  {
    id: "job-fail",
    fileId: "file-fail",
    type: "complaint_analysis",
    status: "failed",
    progress: 18,
    stage: "parsing",
    error: {
      code: "EXTRACT_UNSUPPORTED",
      message: "HWPX 추출기는 아직 연결되어 있지 않습니다.",
    },
  },
];

export const qualityByFile: Record<string, QualityIssue[]> = {
  "file-pohang": [
    {
      type: "missing_metadata",
      severity: "medium",
      count: 31,
      location: null,
      message: "번호·날짜·위치가 없는 행 31개가 발견되었습니다.",
    },
    {
      type: "system_text",
      severity: "low",
      count: 7,
      location: "신고상담내용",
      message: "시스템·테스트 문구로 보이는 행 7개가 발견되었습니다.",
    },
    {
      type: "split_rows",
      severity: "medium",
      count: 4,
      location: "신고상담내용",
      message: "한 민원이 여러 행으로 나뉜 것으로 보이는 행 4개가 발견되었습니다.",
    },
    {
      type: "column_swap",
      severity: "high",
      count: 72,
      location: "경도, 위도",
      message: "경도·위도 열 이름이 서로 바뀌어 있습니다.",
    },
    {
      type: "out_of_range",
      severity: "low",
      count: 1,
      location: "경도, 위도",
      message: "포항 범위 밖 좌표 1개가 발견되었습니다.",
    },
    {
      type: "missing_values",
      severity: "low",
      count: 3,
      location: "신고상담내용",
      message: "신고상담내용 필드에 결측치가 있습니다.",
    },
  ],
};

export const monthlyTrend: MonthlyPoint[] = [
  { period: "2025-11", count: 980 },
  { period: "2025-12", count: 890 },
  { period: "2026-01", count: 742 },
  { period: "2026-02", count: 801 },
  { period: "2026-03", count: 866 },
  { period: "2026-04", count: 954 },
  { period: "2026-05", count: 1020 },
  { period: "2026-06", count: 1188 },
  { period: "2026-07", count: 1402 },
  { period: "2026-08", count: 1210 },
  { period: "2026-09", count: 1106 },
  { period: "2026-10", count: 1284 },
];

export const regions: RegionCount[] = [
  { name: "수청동", count: 186 },
  { name: "대잠동", count: 154 },
  { name: "해도동", count: 133 },
  { name: "장성동", count: 121 },
  { name: "양덕동", count: 109 },
  { name: "상대동", count: 97 },
  { name: "죽도동", count: 88 },
  { name: "지역 없음", count: 396 },
];

export const urgencyCounts: UrgencyCount[] = [
  { urgency: "긴급", count: 42 },
  { urgency: "높음", count: 268 },
  { urgency: "보통", count: 812 },
  { urgency: "낮음", count: 162 },
];

export const healthTrend: HealthPoint[] = [
  { period: "2026-05", unassigned: 7.2, ambiguous: 4.8 },
  { period: "2026-06", unassigned: 7.8, ambiguous: 5.0 },
  { period: "2026-07", unassigned: 6.9, ambiguous: 4.6 },
  { period: "2026-08", unassigned: 9.4, ambiguous: 5.5 },
  { period: "2026-09", unassigned: 8.4, ambiguous: 5.1 },
  { period: "2026-10", unassigned: 11.1, ambiguous: 6.7 },
];

export const mappings: Mapping[] = [
  {
    id: "map-1",
    type: "merge",
    fromCategoryId: "CAT-0090",
    toCategoryId: "CAT-0031",
    fromName: "보도 파임",
    toName: "보도블록 파손",
    fromVersion: 2,
    toVersion: 3,
    reason: "중심 유사도 0.87",
    createdAt: "2026-10-02",
  },
  {
    id: "map-2",
    type: "split",
    fromCategoryId: "CAT-0010",
    toCategoryId: "CAT-0012",
    fromName: "조명 고장",
    toName: "가로등 고장",
    fromVersion: 2,
    toVersion: 3,
    reason: "내부 편차가 커 가로등과 보안등으로 나눔",
    createdAt: "2026-10-02",
  },
  {
    id: "map-3",
    type: "split",
    fromCategoryId: "CAT-0010",
    toCategoryId: "CAT-0018",
    fromName: "조명 고장",
    toName: "보안등 고장",
    fromVersion: 2,
    toVersion: 3,
    reason: "내부 편차가 커 가로등과 보안등으로 나눔",
    createdAt: "2026-10-02",
  },
];

export const surges = [
  { categoryId: "CAT-0070", count: 58, baseline: 22 },
  { categoryId: "CAT-0050", count: 44, baseline: 20 },
];

export function categoryById(id: string | null | undefined): Category | undefined {
  if (!id) return undefined;
  return categories.find((category) => category.categoryId === id);
}

export function complaintById(id: string): Complaint | undefined {
  return complaints.find((complaint) => complaint.id === id);
}

export function issueById(id: string): Issue | undefined {
  return issues.find((issue) => issue.id === id);
}

export function jobByFileId(fileId: string): Job | undefined {
  return jobs.find((job) => job.fileId === fileId);
}

export function complaintsByFile(fileId: string): Complaint[] {
  return complaints.filter((item) => item.fileId === fileId);
}

export function complaintsByIssue(issueId: string): Complaint[] {
  return complaints.filter((item) => item.issueId === issueId);
}

export type CategoryGroup = {
  group: string;
  count: number;
  previousCount: number;
  categories: Category[];
};

export function groupedCategories(): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const category of categories) {
    const current = map.get(category.group) ?? {
      group: category.group,
      count: 0,
      previousCount: 0,
      categories: [],
    };
    current.count += category.count;
    current.previousCount += category.previousCount;
    current.categories.push(category);
    map.set(category.group, current);
  }
  return [...map.values()]
    .map((group) => ({
      ...group,
      categories: [...group.categories].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

export function isPriority(item: Complaint): boolean {
  const affected = item.attributes.affected;
  return (
    item.attributes.urgency === "긴급" ||
    affected === "어린이" ||
    affected === "노인" ||
    affected === "장애인"
  );
}
