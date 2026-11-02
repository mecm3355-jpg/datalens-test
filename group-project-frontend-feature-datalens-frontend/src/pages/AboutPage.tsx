import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import heroImage from "../assets/about-hero.png";
import categoryImage from "../assets/about-category.jpg";
import reviewImage from "../assets/about-review.jpg";
import dataImage from "../assets/about-data.jpg";
import flowImage from "../assets/about-flow.jpg";
import "../styles/about.css";

const copy =
  "데이터렌즈는 민원 동향과 카테고리를 한 화면에서 보고 정리할 수 있게 만든 분석 서비스입니다.";

const features = [
  {
    title: "민원 동향",
    body: "기간별 민원 추이와 전체 현황을 한눈에 확인하세요.",
    image: heroImage,
    imageAlt: "민원 분석 화면",
  },
  {
    title: "카테고리별 집계",
    body: "민원 유형별 건수와 비중을 자동으로 집계하세요.",
    image: categoryImage,
    imageAlt: "건수와 비중을 보여주는 집계 화면",
  },
  {
    title: "주요 이슈 및 검토",
    body: "분석 결과를 검토하고 확인이 필요한 항목을 파악하세요.",
    image: reviewImage,
    imageAlt: "여러 현황을 함께 검토하는 화면",
  },
  {
    title: "데이터 관리",
    body: "분석한 데이터와 결과를 저장하고 다시 활용하세요.",
    image: dataImage,
    imageAlt: "저장된 데이터가 이어지는 모습",
  },
] as const;

const spots = [
  { title: "대시보드", to: "/" },
  { title: "파일", to: "/files" },
  { title: "카테고리", to: "/categories" },
  { title: "검토", to: "/reviews" },
  { title: "이슈", to: "/issues" },
];

const introSteps = [
  {
    title: "데이터 분석 및 자동 집계",
    body: "복잡한 데이터도 파일 업로드만으로 분석을 시작하세요. 반복적인 집계 과정을 자동화해 주요 현황과 데이터 흐름을 빠르게 파악할 수 있습니다.",
    icon: "chart",
  },
  {
    title: "데이터 검토 및 이슈 확인",
    body: "분석 결과를 검토하고 주요 이슈를 한눈에 확인하세요. 놓치기 쉬운 확인 사항을 빠르게 파악해 데이터 검토의 효율성을 높일 수 있습니다.",
    icon: "check",
  },
  {
    title: "민원 유형 자동 분류",
    body: "민원 데이터를 유형별로 분류해 반복되는 문의와 주요 이슈를 쉽게 확인하세요. 수작업으로 분류하고 정리하는 시간을 줄여 문제 해결에 집중할 수 있습니다.",
    icon: "flow",
  },
  {
    title: "데이터 저장 및 관리",
    body: "분석한 데이터를 저장하고 필요할 때 다시 확인하세요. 데이터와 분석 결과를 체계적으로 관리해 반복 업무를 줄이고 지속적인 활용을 지원합니다.",
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
          민원 데이터 분석,
          <br />
          업로드 한 번으로 끝내세요.
        </h1>
        <p>
          데이터 업로드부터 자동 집계, 민원 분류와 결과 관리까지.
          <br className="about-hero-break" />
          반복 업무를 줄이고 핵심 이슈를 빠르게 파악하세요.
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
              <h3>복잡한 민원 데이터 분석, 한 번에 해결하세요.</h3>
              <p>
                데이터 파일 업로드만으로 자동 집계부터 민원 유형 분류까지.
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
            데이터렌즈는 민원 동향과 카테고리를 한 화면에서
            <br className="about-quote-break" />
            보고 정리할 수 있게 만든 분석 서비스입니다.
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
        <p>DataLens로 반복적인 분석 업무를 줄이고 민원 데이터의 핵심을 확인해 보세요.</p>
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
