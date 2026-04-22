import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { fetchMe, getGoogleLoginUrl } from "./api";

export function LoginPage() {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
  });

  if (meQuery.isLoading) {
    return (
      <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
        <p className="p-8">Loading...</p>
      </main>
    );
  }

  if (meQuery.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-20">
        <div className="flex items-center gap-3">
          <img src="/salesforce-logo.png" alt="Salesforce" className="h-12 w-auto object-contain" />
          <h1 className="text-3xl font-bold">SF AI Library</h1>
        </div>
        <p className="text-(--color-text-muted)">Your AI toolkit. Find what works. Share what you've built.</p>
        <a
          className="inline-flex w-fit rounded bg-(--color-primary) px-4 py-2 font-bold text-white hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
          href={getGoogleLoginUrl()}
        >
          Continue with Google
        </a>
        <div className="mt-4 flex gap-4 text-sm text-(--color-text-muted)">
          <a href="/terms" className="link hover:underline">
            Terms of Service
          </a>
          <a href="/privacy" className="link hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
      <footer className="mx-auto mt-8 max-w-xl rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-text-muted)">
        Copyright 2026. All Rights Reserved. Created with ❤️ by Amelia Ochodnicky. v{import.meta.env.VITE_APP_VERSION}
      </footer>
    </main>
  );
}
