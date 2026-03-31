import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/api";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
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
