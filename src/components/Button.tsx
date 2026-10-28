import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonProps = {
  variant?: "primary" | "secondary" | "text" | "pill";
  to?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  to,
  type = "button",
  disabled,
  onClick,
  children,
  className,
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
