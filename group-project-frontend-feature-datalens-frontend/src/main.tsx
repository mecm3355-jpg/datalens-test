import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { App } from "./App";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/signup.css";
import { AppError } from "./api/AppError";

const root = document.getElementById("root");
if (!root) {
  throw new AppError("ROOT_ELEMENT_MISSING", "애플리케이션 루트 요소가 없습니다.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
