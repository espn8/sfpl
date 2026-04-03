import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/api";
import { ThemeModeToggle } from "./ui/ThemeModeToggle";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <nav className="flex gap-4 text-sm">
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/">
              Prompts
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/prompts/new">
              New Prompt
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/collections">
              Collections
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/analytics">
              Analytics
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/settings">
              Settings
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeModeToggle />
            <button
              type="button"
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface) focus-visible:outline-none"
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
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
