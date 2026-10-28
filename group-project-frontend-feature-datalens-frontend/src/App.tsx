import { BrowserRouter, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { CandidatesPage } from "./pages/CandidatesPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ComplaintDetailPage } from "./pages/ComplaintDetailPage";
import { ComplaintsPage } from "./pages/ComplaintsPage";
import { AboutPage } from "./pages/AboutPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataPage } from "./pages/DataPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { FileCleaningPage } from "./pages/FileCleaningPage";
import { FilesPage } from "./pages/FilesPage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { IssuesPage } from "./pages/IssuesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { SessionProvider } from "./state/session";
import { WorkspaceProvider } from "./state/workspace";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <WorkspaceProvider>
          <RouteErrorBoundary>
            <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route element={<AppShell />}>
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
            <Route path="data" element={<DataPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="complaints/:complaintId" element={<ComplaintDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
            </Routes>
          </RouteErrorBoundary>
        </WorkspaceProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
