import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button";
import heroImage from "../assets/about-hero.png";
import categoryImage from "../assets/about-category.jpg";
import reviewImage from "../assets/about-review.jpg";
import dataImage from "../assets/about-data.jpg";
import flowImage from "../assets/about-flow.jpg";
import "../styles/about.css";

const copy =
  "데이터렌즈는 파일 수집, 품질 진단, 규칙 승인, 정제 결과를 한 흐름으로 관리하는 데이터 품질 서비스입니다.";

const features = [
  {
    title: "파일 품질 현황",
    body: "파일별 처리 상태와 완전성·유일성·유효성·일관성을 한눈에 확인하세요.",
    image: heroImage,
    imageAlt: "데이터 품질 분석 화면",
  },
  {
    title: "형식별 데이터 추출",
    body: "CSV·JSON·텍스트·이미지에서 필요한 데이터와 메타데이터를 추출하세요.",
    image: categoryImage,
    imageAlt: "건수와 비중을 보여주는 집계 화면",
  },
  {
    title: "정제 규칙 승인",
    body: "예상 변경 건수를 확인하고 필요한 규칙만 선택해 적용하세요.",
    image: reviewImage,
    imageAlt: "정제 규칙을 검토하는 화면",
  },
  {
    title: "데이터 관리",
    body: "원본과 정제 결과를 비교하고 CSV 또는 JSON으로 내려받으세요.",
    image: dataImage,
    imageAlt: "저장된 데이터가 이어지는 모습",
  },
] as const;

const spots = [
  { title: "대시보드", to: "/" },
  { title: "파일", to: "/files" },
  { title: "분석 리포트", to: "/data" },
];

const introSteps = [
  {
    title: "형식 검증 및 데이터 추출",
    body: "확장자뿐 아니라 실제 내용을 확인하고 형식에 맞는 추출기로 미리보기와 기본 통계를 생성합니다.",
    icon: "chart",
  },
  {
    title: "품질 진단 및 영향 확인",
    body: "누락값, 중복, 공백, 날짜 형식 문제를 찾고 규칙을 적용하기 전에 예상 변경 건수를 확인합니다.",
    icon: "check",
  },
  {
    title: "승인 기반 데이터 정제",
    body: "추천 규칙은 자동 실행하지 않습니다. 사용자가 선택한 규칙만 적용하고 원본과 결과를 나란히 비교합니다.",
    icon: "flow",
  },
  {
    title: "데이터 저장 및 관리",
    body: "정제 결과를 CSV 또는 JSON으로 내려받고, 백엔드 연결 후에는 작업 이력과 결과 버전을 계속 관리합니다.",
    icon: "file",
  },
] as const;

export function AboutPage() {
  const [feature, setFeature] = useState<(typeof features)[number]["title"]>(features[0].title);
  const activeFeature = features.find((item) => item.title === feature) ?? features[0];

  return (
    <div className="page about">
      <section className="about-hero">
        <h1>
          데이터 품질 관리,
          <br />
          업로드 한 번으로 끝내세요.
        </h1>
        <p>
          파일 업로드부터 품질 진단, 규칙 승인과 결과 관리까지.
          <br className="about-hero-break" />
          코딩 없이 데이터 문제를 찾고 안전하게 정제하세요.
        </p>
        <div className="about-actions">
          <Button to="/">대시보드 보기</Button>
          <Button to="/signup" variant="secondary">
            서비스 시작하기
          </Button>
        </div>
      </section>

      <section className="about-feature" aria-labelledby="about-feature-title">
        <h2 id="about-feature-title">기능</h2>
        <div className="about-tabs" role="tablist" aria-label="기능">
          {features.map((item) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              className={item.title === feature ? "is-active" : undefined}
              aria-selected={item.title === feature}
              onClick={() => setFeature(item.title)}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="about-stage" role="tabpanel">
          <img className="about-stage-photo" src={activeFeature.image} alt={activeFeature.imageAlt} />
          <div className="about-stage-copy">
            <p className="about-stage-label">{activeFeature.title}</p>
            <p>{activeFeature.body}</p>
          </div>
        </div>
      </section>

      <section className="about-bento" aria-labelledby="about-bento-title">
        <h2 id="about-bento-title">DataLens 소개</h2>
        <div className="about-bento-grid">
          <article className="about-card about-card-lead">
            <img className="about-lead-image" src={flowImage} alt="" />
            <div className="about-lead-copy">
              <h3>흩어진 파일의 품질 관리, 한 번에 해결하세요.</h3>
              <p>
                여러 파일 업로드부터 형식 검증과 정제 결과 생성까지.
                <br />
                반복적인 데이터 정리 업무를 줄이고, 더 빠른 의사결정을 시작하세요.
              </p>
            </div>
          </article>
          {introSteps.map((step) => (
            <article key={step.title} className="about-card about-step">
              <div className="about-step-head">
                <h3>{step.title}</h3>
                <span className={`about-step-icon is-${step.icon}`} aria-hidden="true">
                  <StepIcon name={step.icon} />
                </span>
              </div>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-quote">
        <blockquote>
          <p>
            데이터렌즈는 파일 상태와 품질 지표를 한 화면에서
            <br className="about-quote-break" />
            확인하고 정제할 수 있게 만든 분석 서비스입니다.
          </p>
        </blockquote>
      </section>

      <section className="about-stories" aria-labelledby="about-stories-title">
        <h2 id="about-stories-title">둘러보기</h2>
        <div className="about-story-grid">
          {spots.slice(0, 3).map((spot) => (
            <article key={spot.title} className="about-card">
              <h3>{spot.title}</h3>
              <p>{copy}</p>
              <Link to={spot.to}>이동</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="about-close">
        <h2>데이터 정리는 간편하게, 문제 해결은 더 빠르게!</h2>
        <p>DataLens로 반복적인 정리 업무를 줄이고 데이터 품질의 핵심을 확인해 보세요.</p>
        <div className="about-actions">
          <Button to="/">대시보드 보기</Button>
        </div>
      </section>
    </div>
  );
}

function StepIcon({ name }: { name: (typeof introSteps)[number]["icon"] }) {
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V13" />
        <path d="M10 19V9" />
        <path d="M15 19V6" />
        <path d="M20 19V3" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="5" width="10" height="15" rx="2" />
        <path d="M9 5.2V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2v1" />
        <path d="M9.4 13.1 11.2 15l3.4-3.8" />
      </svg>
    );
  }
  if (name === "flow") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 12.2 11 5h8.5v8.2l-7.6 7.3a1.6 1.6 0 0 1-2.2 0L3.5 12.2Z" />
        <circle cx="8.2" cy="9.2" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  );
}
