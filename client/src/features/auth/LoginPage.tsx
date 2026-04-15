import { getGoogleLoginUrl } from "./api";

export function LoginPage() {
  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-20">
        <img src="/salesforce-logo.svg" alt="Salesforce" className="h-12 w-auto" />
        <h1 className="text-3xl font-bold">AI Library</h1>
        <p className="text-(--color-text-muted)">Prompts, skills, and context for your team.</p>
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
    </main>
  );
}
