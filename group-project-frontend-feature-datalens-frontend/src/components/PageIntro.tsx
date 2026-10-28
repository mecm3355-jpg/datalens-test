import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  lede?: string;
  size?: "md" | "sm";
  actions?: ReactNode;
};

export function PageIntro({ eyebrow, title, lede, size = "sm", actions }: PageIntroProps) {
  return (
    <header className="page-hero">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className={size === "md" ? "display-md" : "display-sm"}>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="hero-actions">{actions}</div> : null}
    </header>
  );
}
