import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { AppShell } from "../components/AppShell";
import { AdminRoute } from "../components/AdminRoute";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { WriterRoute } from "../components/WriterRoute";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { AdminHelpPage } from "../features/admin/AdminHelpPage";
import { ToolRequestsPage } from "../features/admin/ToolRequestsPage";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { CollectionDetailPage } from "../features/collections/CollectionDetailPage";
import { CollectionsPage } from "../features/collections/CollectionsPage";
import { PromptDetailPage } from "../features/prompts/PromptDetailPage";
import { PromptEditPage } from "../features/prompts/PromptEditPage";
import { PromptEditorPage } from "../features/prompts/PromptEditorPage";
import { PromptsListPage } from "../features/prompts/PromptsListPage";
import { ContextDetailPage } from "../features/context/ContextDetailPage";
import { ContextEditPage } from "../features/context/ContextEditPage";
import { ContextEditorPage } from "../features/context/ContextEditorPage";
import { ContextListPage } from "../features/context/ContextListPage";
import { HomePage } from "../features/home/HomePage";
import { SearchResultsPage } from "../features/search/SearchResultsPage";
import { SkillDetailPage } from "../features/skills/SkillDetailPage";
import { SkillEditPage } from "../features/skills/SkillEditPage";
import { SkillEditorPage } from "../features/skills/SkillEditorPage";
import { SkillListPage } from "../features/skills/SkillListPage";
import { BuildDetailPage } from "../features/builds/BuildDetailPage";
import { BuildEditPage } from "../features/builds/BuildEditPage";
import { BuildEditorPage } from "../features/builds/BuildEditorPage";
import { BuildListPage } from "../features/builds/BuildListPage";
import { HelpPage } from "../features/help/HelpPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { ChangelogPage } from "../pages/ChangelogPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { TermsPage } from "../pages/TermsPage";

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return null;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <HomePage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <AppShell>
                <SearchResultsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <AppShell>
                <PromptsListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts/new"
          element={
            <WriterRoute>
              <AppShell>
                <PromptEditorPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/prompts/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <PromptDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts/:id/edit"
          element={
            <WriterRoute>
              <AppShell>
                <PromptEditPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <AppShell>
                <SkillListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/skills/new"
          element={
            <WriterRoute>
              <AppShell>
                <SkillEditorPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/skills/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <SkillDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/skills/:id/edit"
          element={
            <WriterRoute>
              <AppShell>
                <SkillEditPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/context"
          element={
            <ProtectedRoute>
              <AppShell>
                <ContextListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/context/new"
          element={
            <WriterRoute>
              <AppShell>
                <ContextEditorPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/context/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <ContextDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/context/:id/edit"
          element={
            <WriterRoute>
              <AppShell>
                <ContextEditPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/builds"
          element={
            <ProtectedRoute>
              <AppShell>
                <BuildListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/builds/new"
          element={
            <WriterRoute>
              <AppShell>
                <BuildEditorPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/builds/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <BuildDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/builds/:id/edit"
          element={
            <WriterRoute>
              <AppShell>
                <BuildEditPage />
              </AppShell>
            </WriterRoute>
          }
        />
        <Route
          path="/collections"
          element={
            <ProtectedRoute>
              <AppShell>
                <CollectionsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/collections/:id"
          element={
            <ProtectedRoute>
              <AppShell>
                <CollectionDetailPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminRoute>
                  <AnalyticsPage />
                </AdminRoute>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/help"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminRoute>
                  <AdminHelpPage />
                </AdminRoute>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tool-requests"
          element={
            <ProtectedRoute>
              <AppShell>
                <AdminRoute>
                  <ToolRequestsPage />
                </AdminRoute>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <AppShell>
                <HelpPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppShell>
                <SettingsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/changelog"
          element={
            <ProtectedRoute>
              <AppShell>
                <ChangelogPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
