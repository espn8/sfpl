import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { HomePage } from "../features/home/HomePage";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AppShell } from "../components/AppShell";
import { PromptsListPage } from "../features/prompts/PromptsListPage";
import { SkillListPage } from "../features/skills/SkillListPage";
import { ContextListPage } from "../features/context/ContextListPage";
import { BuildListPage } from "../features/builds/BuildListPage";
import { CollectionsPage } from "../features/collections/CollectionsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { HelpPage } from "../features/help/HelpPage";
import { TermsPage } from "../pages/TermsPage";
import { PrivacyPage } from "../pages/PrivacyPage";

const AuthenticatedHomePage = lazy(() =>
  import("../features/home/AuthenticatedHomePage").then((module) => ({
    default: module.AuthenticatedHomePage,
  })),
);

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
        <Route path="/" element={<HomePage />} />
        <Route path="/temp" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <AppShell>
                <Suspense fallback={<main className="p-8">Loading...</main>}>
                  <AuthenticatedHomePage />
                </Suspense>
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
          path="/help"
          element={
            <ProtectedRoute>
              <AppShell>
                <HelpPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
