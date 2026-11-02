import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CandidatesPage } from "./pages/CandidatesPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ComplaintDetailPage } from "./pages/ComplaintDetailPage";
import { ComplaintsPage } from "./pages/ComplaintsPage";
import { AboutPage } from "./pages/AboutPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataPage } from "./pages/DataPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { FilesPage } from "./pages/FilesPage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { IssuesPage } from "./pages/IssuesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ProgressWatcher } from "./components/ProgressWatcher";
import { CatalogProvider } from "./state/catalog";
import { ProgressProvider } from "./state/progress";
import { SessionProvider, useSession } from "./state/session";

/**
 * 로그인한 사용자에게만 앱 화면을 보여 줍니다. 서버 API는 로그인을 요구하므로, 로그인 전에
 * 데이터를 부르지 않도록 CatalogProvider도 이 안에 둡니다.
 */
function ProtectedShell() {
  const { loggedIn, loading } = useSession();
  if (loading) return <p className="notice">세션을 확인하는 중입니다.</p>;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return (
    <CatalogProvider>
      <ProgressWatcher />
      <AppShell />
    </CatalogProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ProgressProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route element={<ProtectedShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="files/:fileId" element={<FileDetailPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="categories/candidates" element={<CandidatesPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="issues" element={<IssuesPage />} />
            <Route path="issues/:issueId" element={<IssueDetailPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="complaints/:complaintId" element={<ComplaintDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </ProgressProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
