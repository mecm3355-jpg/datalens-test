import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { ComplaintDataProvider } from "./state/complaintData";
import { SessionProvider, useSession } from "./state/session";
import { WorkspaceProvider } from "./state/workspace";

const AboutPage = lazy(() => import("./pages/AboutPage").then((module) => ({ default: module.AboutPage })));
const CandidatesPage = lazy(() => import("./pages/CandidatesPage").then((module) => ({ default: module.CandidatesPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const ComplaintDetailPage = lazy(() => import("./pages/ComplaintDetailPage").then((module) => ({ default: module.ComplaintDetailPage })));
const ComplaintsPage = lazy(() => import("./pages/ComplaintsPage").then((module) => ({ default: module.ComplaintsPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DataPage = lazy(() => import("./pages/DataPage").then((module) => ({ default: module.DataPage })));
const FileCleaningPage = lazy(() => import("./pages/FileCleaningPage").then((module) => ({ default: module.FileCleaningPage })));
const FileDetailPage = lazy(() => import("./pages/FileDetailPage").then((module) => ({ default: module.FileDetailPage })));
const FilesPage = lazy(() => import("./pages/FilesPage").then((module) => ({ default: module.FilesPage })));
const IssueDetailPage = lazy(() => import("./pages/IssueDetailPage").then((module) => ({ default: module.IssueDetailPage })));
const IssuesPage = lazy(() => import("./pages/IssuesPage").then((module) => ({ default: module.IssuesPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage").then((module) => ({ default: module.ReviewsPage })));

function ProtectedShell() {
  const { loggedIn, loading } = useSession();
  if (loading) return <p className="notice">세션을 확인하는 중입니다.</p>;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return (
    <WorkspaceProvider>
      <ComplaintDataProvider>
        <AppShell />
      </ComplaintDataProvider>
    </WorkspaceProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <RouteErrorBoundary>
          <Suspense fallback={<p className="notice">화면을 불러오는 중입니다.</p>}>
            <Routes>
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<Navigate to="/login" replace />} />
              <Route element={<ProtectedShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="files" element={<FilesPage />} />
                <Route path="files/:fileId" element={<FileDetailPage />} />
                <Route path="files/:fileId/cleaning" element={<FileCleaningPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="categories/candidates" element={<CandidatesPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="issues" element={<IssuesPage />} />
                <Route path="issues/:issueId" element={<IssueDetailPage />} />
                <Route path="complaints" element={<ComplaintsPage />} />
                <Route path="complaints/:complaintId" element={<ComplaintDetailPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </SessionProvider>
    </BrowserRouter>
  );
}
