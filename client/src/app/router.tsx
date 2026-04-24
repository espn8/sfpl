import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { AppShell } from "../components/AppShell";
import { AdminRoute } from "../components/AdminRoute";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { WriterRoute } from "../components/WriterRoute";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage } from "../features/home/HomePage";

/**
 * Route-level code splitting.
 *
 * The homepage, login, and the terms/privacy static pages are kept eager
 * because they cover ~all unauthenticated traffic and the initial
 * authenticated landing page. Everything else is loaded on demand the first
 * time the user navigates to it, so a cold homepage visit only pulls down
 * the HomePage code + shell.
 */
const AdminDashboardPage = lazy(() =>
  import("../features/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminHelpPage = lazy(() =>
  import("../features/admin/AdminHelpPage").then((m) => ({ default: m.AdminHelpPage })),
);
const ToolRequestsPage = lazy(() =>
  import("../features/admin/ToolRequestsPage").then((m) => ({ default: m.ToolRequestsPage })),
);
const AnalyticsPage = lazy(() =>
  import("../features/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
const CollectionDetailPage = lazy(() =>
  import("../features/collections/CollectionDetailPage").then((m) => ({ default: m.CollectionDetailPage })),
);
const CollectionsPage = lazy(() =>
  import("../features/collections/CollectionsPage").then((m) => ({ default: m.CollectionsPage })),
);
const PromptDetailPage = lazy(() =>
  import("../features/prompts/PromptDetailPage").then((m) => ({ default: m.PromptDetailPage })),
);
const PromptEditPage = lazy(() =>
  import("../features/prompts/PromptEditPage").then((m) => ({ default: m.PromptEditPage })),
);
const PromptEditorPage = lazy(() =>
  import("../features/prompts/PromptEditorPage").then((m) => ({ default: m.PromptEditorPage })),
);
const PromptsListPage = lazy(() =>
  import("../features/prompts/PromptsListPage").then((m) => ({ default: m.PromptsListPage })),
);
const ContextDetailPage = lazy(() =>
  import("../features/context/ContextDetailPage").then((m) => ({ default: m.ContextDetailPage })),
);
const ContextEditPage = lazy(() =>
  import("../features/context/ContextEditPage").then((m) => ({ default: m.ContextEditPage })),
);
const ContextEditorPage = lazy(() =>
  import("../features/context/ContextEditorPage").then((m) => ({ default: m.ContextEditorPage })),
);
const ContextListPage = lazy(() =>
  import("../features/context/ContextListPage").then((m) => ({ default: m.ContextListPage })),
);
const SearchResultsPage = lazy(() =>
  import("../features/search/SearchResultsPage").then((m) => ({ default: m.SearchResultsPage })),
);
const SkillDetailPage = lazy(() =>
  import("../features/skills/SkillDetailPage").then((m) => ({ default: m.SkillDetailPage })),
);
const SkillEditPage = lazy(() =>
  import("../features/skills/SkillEditPage").then((m) => ({ default: m.SkillEditPage })),
);
const SkillEditorPage = lazy(() =>
  import("../features/skills/SkillEditorPage").then((m) => ({ default: m.SkillEditorPage })),
);
const SkillListPage = lazy(() =>
  import("../features/skills/SkillListPage").then((m) => ({ default: m.SkillListPage })),
);
const BuildDetailPage = lazy(() =>
  import("../features/builds/BuildDetailPage").then((m) => ({ default: m.BuildDetailPage })),
);
const BuildEditPage = lazy(() =>
  import("../features/builds/BuildEditPage").then((m) => ({ default: m.BuildEditPage })),
);
const BuildEditorPage = lazy(() =>
  import("../features/builds/BuildEditorPage").then((m) => ({ default: m.BuildEditorPage })),
);
const BuildListPage = lazy(() =>
  import("../features/builds/BuildListPage").then((m) => ({ default: m.BuildListPage })),
);
const HelpPage = lazy(() =>
  import("../features/help/HelpPage").then((m) => ({ default: m.HelpPage })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ChangelogPage = lazy(() =>
  import("../pages/ChangelogPage").then((m) => ({ default: m.ChangelogPage })),
);
const PrivacyPage = lazy(() =>
  import("../pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("../pages/TermsPage").then((m) => ({ default: m.TermsPage })),
);

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return null;
}

function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="flex h-full min-h-[40vh] items-center justify-center"
    >
      <div
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-accent)"
      />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
