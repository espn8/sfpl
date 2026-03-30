import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { trackEvent, trackPageView } from "./analytics";
import { getAnalyticsOverview } from "../features/analytics/api";
import { fetchMe, getGoogleLoginUrl, logout } from "../features/auth/api";
import { createCollection, listCollections } from "../features/collections/api";
import { createPrompt, getPrompt, listPrompts, logUsage, ratePrompt, toggleFavorite, updatePrompt } from "../features/prompts/api";
import { PrivacyPage } from "../pages/PrivacyPage";
import { TermsPage } from "../pages/TermsPage";

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return null;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between">
          <nav className="flex gap-4 text-sm">
            <Link to="/">Prompts</Link>
            <Link to="/prompts/new">New Prompt</Link>
            <Link to="/collections">Collections</Link>
            <Link to="/analytics">Analytics</Link>
          </nav>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => {
              void (async () => {
                await logout();
                await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
                navigate("/login");
              })();
            }}
          >
            Logout
          </button>
        </header>
        {children}
      </div>
    </main>
  );
}

function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-20">
        <h1 className="text-3xl font-bold">Prompt Library</h1>
        <p>Sign in with Google to access your team workspace.</p>
        <a className="inline-flex w-fit rounded bg-slate-900 px-4 py-2 text-white" href={getGoogleLoginUrl()}>
          Continue with Google
        </a>
        <div className="mt-4 flex gap-4 text-sm text-slate-600">
          <a href="/terms" className="hover:underline">
            Terms of Service
          </a>
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
  });

  if (meQuery.isLoading) {
    return <p className="p-8">Loading session...</p>;
  }

  if (meQuery.error instanceof AxiosError && meQuery.error.response?.status === 401) {
    return <Navigate to="/login" replace />;
  }

  if (meQuery.error) {
    return <p className="p-8 text-red-700">Authentication check failed.</p>;
  }

  return <>{children}</>;
}

function PromptListPage() {
  const promptsQuery = useQuery({ queryKey: ["prompts"], queryFn: listPrompts });
  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }
  if (promptsQuery.error) {
    return <p className="text-red-700">Failed to load prompts.</p>;
  }
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Prompt Discovery</h2>
      {promptsQuery.data?.map((prompt) => (
        <Link key={prompt.id} to={`/prompts/${prompt.id}`} className="block rounded border bg-white p-4">
          <p className="font-semibold">{prompt.title}</p>
          <p className="text-sm text-slate-600">{prompt.summary ?? "No summary"}</p>
        </Link>
      ))}
    </div>
  );
}

function PromptEditorPage() {
  const navigate = useNavigate();
  const createMutation = useMutation({
    mutationFn: createPrompt,
    onSuccess: (prompt) => {
      trackEvent("prompt_create", { prompt_id: prompt.id });
      navigate(`/prompts/${prompt.id}`);
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "").trim();
        if (!title || !body) {
          return;
        }
        createMutation.mutate({ title, summary, body });
      }}
    >
      <h2 className="text-2xl font-semibold">Create Prompt</h2>
      <input name="title" placeholder="Title" className="w-full rounded border px-3 py-2" />
      <input name="summary" placeholder="Summary" className="w-full rounded border px-3 py-2" />
      <textarea name="body" placeholder="Prompt body" className="h-48 w-full rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Prompt
      </button>
    </form>
  );
}

function PromptDetailPage() {
  const params = useParams();
  const promptId = Number(params.id);
  const [rating, setRating] = useState(5);
  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId),
  });
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (payload: { body: string }) => updatePrompt(promptId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
    },
  });

  useEffect(() => {
    if (Number.isInteger(promptId)) {
      void logUsage(promptId, "VIEW");
      trackEvent("prompt_view", { prompt_id: promptId });
    }
  }, [promptId]);

  const launchUrl = useMemo(() => {
    const body = promptQuery.data?.body ?? "";
    return `https://chat.openai.com/?model=gpt-4o&prompt=${encodeURIComponent(body)}`;
  }, [promptQuery.data?.body]);

  if (promptQuery.isLoading) {
    return <p>Loading prompt...</p>;
  }
  if (!promptQuery.data) {
    return <p className="text-red-700">Prompt not found.</p>;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{promptQuery.data.title}</h2>
      <p>{promptQuery.data.summary}</p>
      <textarea
        className="h-56 w-full rounded border px-3 py-2"
        defaultValue={promptQuery.data.body}
        onBlur={(event) => {
          const body = event.target.value;
          if (body && body !== promptQuery.data?.body) {
            updateMutation.mutate({ body });
          }
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void navigator.clipboard.writeText(promptQuery.data?.body ?? "");
            void logUsage(promptId, "COPY");
            trackEvent("prompt_copy", { prompt_id: promptId });
          }}
        >
          Copy
        </button>
        <a
          href={launchUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void logUsage(promptId, "LAUNCH");
            trackEvent("prompt_launch", { prompt_id: promptId });
          }}
        >
          Launch
        </a>
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void toggleFavorite(promptId);
            trackEvent("prompt_favorite_toggle", { prompt_id: promptId });
          }}
        >
          Favorite
        </button>
        <select
          value={rating}
          className="rounded border px-2"
          onChange={(event) => {
            setRating(Number(event.target.value));
          }}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} star
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void ratePrompt(promptId, rating);
            trackEvent("prompt_rate", { prompt_id: promptId, value: rating });
          }}
        >
          Submit Rating
        </button>
      </div>
    </div>
  );
}

function CollectionsPage() {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      trackEvent("collection_create");
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Collections</h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const name = String(formData.get("name") ?? "").trim();
          if (!name) {
            return;
          }
          createMutation.mutate({ name });
          event.currentTarget.reset();
        }}
      >
        <input name="name" className="rounded border px-3 py-2" placeholder="New collection name" />
        <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
          Create
        </button>
      </form>
      {collectionsQuery.data?.map((collection) => (
        <div key={collection.id} className="rounded border bg-white p-4">
          <p className="font-semibold">{collection.name}</p>
          <p className="text-sm text-slate-600">{collection.description}</p>
          <p className="text-xs text-slate-500">{collection.prompts.length} prompts</p>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPage() {
  const analyticsQuery = useQuery({ queryKey: ["analytics", "overview"], queryFn: getAnalyticsOverview });
  if (analyticsQuery.isLoading) {
    return <p>Loading analytics...</p>;
  }
  if (!analyticsQuery.data) {
    return <p className="text-red-700">Analytics unavailable.</p>;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Analytics Overview</h2>
      <section>
        <h3 className="font-semibold">Top Used</h3>
        {analyticsQuery.data.topUsedPrompts.map((item) => (
          <p key={item.id} className="text-sm">{item.title} - {item.usageCount}</p>
        ))}
      </section>
      <section>
        <h3 className="font-semibold">Stale Prompts</h3>
        {analyticsQuery.data.stalePrompts.map((item) => (
          <p key={item.id} className="text-sm">{item.title}</p>
        ))}
      </section>
    </div>
  );
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
