import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listCustomDepartmentOusInUse } from "./api";

export function DepartmentOuAdminPage() {
  const query = useQuery({
    queryKey: ["admin", "department-ous", "custom-in-use"],
    queryFn: listCustomDepartmentOusInUse,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p>
          <Link to="/admin" className="text-sm text-(--color-primary) hover:underline">
            Admin
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Custom Department/OU values</h1>
        <p className="text-sm text-(--color-text-muted)">
          Users who pick <strong>Other</strong> or still have a legacy geographic value (after the{" "}
          <code className="rounded bg-(--color-surface-muted) px-1"> - Sales</code> migration) appear here. To add a
          value to the official dropdown, add the <strong>exact</strong> string to{" "}
          <code className="rounded bg-(--color-surface-muted) px-1">OU_OPTIONS</code> in{" "}
          <code className="rounded bg-(--color-surface-muted) px-1">client/src/constants/ous.ts</code> and mirror it
          in <code className="rounded bg-(--color-surface-muted) px-1">server/src/constants/departmentOuOptions.ts</code>
          , then deploy.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-(--color-text-muted)">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Could not load custom Department/OU values.</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-sm text-(--color-text-muted)">
          No non-canonical Department/OU values in use on this team.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)">
              <tr>
                <th className="px-4 py-2 font-medium">Stored value (User.ou)</th>
                <th className="px-4 py-2 font-medium">Users</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((row) => (
                <tr key={row.ou} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-2 font-mono text-xs break-all">{row.ou}</td>
                  <td className="px-4 py-2 tabular-nums">{row.userCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
