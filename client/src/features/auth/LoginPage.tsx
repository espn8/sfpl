import { getGoogleLoginUrl } from "./api";

export function LoginPage() {
  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-20">
        <h1 className="text-3xl font-bold">Prompt Library</h1>
        <a
          className="inline-flex w-fit rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
          href={getGoogleLoginUrl()}
        >
          Continue with Google
        </a>
        <div className="mt-4 flex gap-4 text-sm text-(--color-text-muted)">
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
