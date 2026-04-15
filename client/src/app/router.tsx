import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { AppShell } from "../components/AppShell";
import { AdminRoute } from "../components/AdminRoute";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { CollectionDetailPage } from "../features/collections/CollectionDetailPage";
import { CollectionsPage } from "../features/collections/CollectionsPage";
import { PromptDetailPage } from "../features/prompts/PromptDetailPage";
import { PromptEditPage } from "../features/prompts/PromptEditPage";
import { PromptEditorPage } from "../features/prompts/PromptEditorPage";
import { ContextDetailPage } from "../features/context/ContextDetailPage";
import { ContextEditPage } from "../features/context/ContextEditPage";
import { ContextEditorPage } from "../features/context/ContextEditorPage";
import { ContextListPage } from "../features/context/ContextListPage";
import { PromptListPage } from "../features/prompts/PromptListPage";
import { SkillDetailPage } from "../features/skills/SkillDetailPage";
import { SkillEditPage } from "../features/skills/SkillEditPage";
import { SkillEditorPage } from "../features/skills/SkillEditorPage";
import { SkillListPage } from "../features/skills/SkillListPage";
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
                <PromptListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts/new"
          element={
            <ProtectedRoute>
              <AppShell>
                <PromptEditorPage />
              </AppShell>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppShell>
                <PromptEditPage />
              </AppShell>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppShell>
                <SkillEditorPage />
              </AppShell>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppShell>
                <SkillEditPage />
              </AppShell>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppShell>
                <ContextEditorPage />
              </AppShell>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppShell>
                <ContextEditPage />
              </AppShell>
            </ProtectedRoute>
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
      </Routes>
    </BrowserRouter>
  );
}
