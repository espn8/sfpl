import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { AppShell } from "../components/AppShell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { CollectionsPage } from "../features/collections/CollectionsPage";
import { PromptDetailPage } from "../features/prompts/PromptDetailPage";
import { PromptEditorPage } from "../features/prompts/PromptEditorPage";
import { PromptListPage } from "../features/prompts/PromptListPage";
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
          path="/analytics"
          element={
            <ProtectedRoute>
              <AppShell>
                <AnalyticsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
