import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { apiClient } from "../../api/client";
import { useToast } from "../../app/providers/ToastProvider";
import { listToolRequests } from "./api";

type ToolStatus = "ready" | "coming_soon";

type AdminTool = {
  id: string;
  title: string;
  description: string;
  to?: string;
  status: ToolStatus;
  badge?: string;
  action?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  icon: React.ReactNode;
};

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const pendingCountQuery = useQuery({
    queryKey: ["toolRequests", { status: "PENDING" }],
    queryFn: () => listToolRequests({ status: "PENDING", pageSize: 1 }),
    select: (result) => result.meta.total,
  });

  const refreshSystemCollections = useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/collections/system/refresh", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
      showToast("System collections refreshed.", "success");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.error?.message ?? error.message
          : error instanceof Error
            ? error.message
            : "Refresh failed.";
      showToast(message, "error");
    },
  });

  const pendingBadge =
    typeof pendingCountQuery.data === "number" && pendingCountQuery.data > 0
      ? `${pendingCountQuery.data} pending`
      : undefined;

  const tools: AdminTool[] = [
    {
      id: "analytics",
      title: "Analytics",
      description: "Top used, top rated, stale, contributors, and user engagement leaderboards.",
      to: "/analytics",
      status: "ready",
      icon: <Icon d="M3 3v18h18 M7 14l4-4 4 4 5-5" />,
    },
    {
      id: "tool-requests",
      title: "Tool Requests",
      description: "Approve, decline, or hold submissions for new AI tools.",
      to: "/admin/tool-requests",
      status: "ready",
      badge: pendingBadge,
      icon: (
        <Icon d="M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      ),
    },
    {
      id: "governance",
      title: "Asset Governance",
      description:
        "Verification sweeps, auto-archive review, and the verification audit log.",
      to: "/admin/governance",
      status: "ready",
      icon: <Icon d="M12 2l9 4v6c0 5-3.8 9.2-9 10-5.2-.8-9-5-9-10V6l9-4z" />,
    },
    {
      id: "ownership",
      title: "Ownership Transfer",
      description:
        "Reassign assets from departing users — one at a time or in bulk.",
      to: "/admin/ownership",
      status: "ready",
      icon: (
        <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8l2 2-2 2 M23 10h-6" />
      ),
    },
    {
      id: "system-collections",
      title: "System Collections",
      description:
        "Force-rebuild tool and Best-of collections after a bulk seed or schema change.",
      status: "ready",
      action: () => refreshSystemCollections.mutate(),
      actionLabel: refreshSystemCollections.isPending ? "Refreshing…" : "Refresh now",
      actionDisabled: refreshSystemCollections.isPending,
      icon: (
        <Icon d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-(--color-text-muted)">
          Run the AI Library — review submissions, monitor engagement, and keep the
          library healthy.
        </p>
      </header>

      <section aria-labelledby="tools-heading" className="space-y-3">
        <h2 id="tools-heading" className="text-lg font-semibold">
          Admin Tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="help-heading" className="space-y-3">
        <h2 id="help-heading" className="text-lg font-semibold">
          Help & Documentation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/admin/help"
            className="group block rounded-xl border border-(--color-border) bg-(--color-surface) p-5 transition-shadow hover:border-(--color-primary) hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
          >
            <div className="mb-2 flex items-center gap-2 text-(--color-primary)">
              <Icon d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" />
              <span className="font-semibold">Admin Help</span>
            </div>
            <p className="text-sm text-(--color-text-muted)">
              Documentation for governance, ownership transfer, analytics
              interpretation, system collections, and tool-request review.
            </p>
          </Link>
          <Link
            to="/help"
            className="group block rounded-xl border border-(--color-border) bg-(--color-surface) p-5 transition-shadow hover:border-(--color-primary) hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
          >
            <div className="mb-2 flex items-center gap-2 text-(--color-text)">
              <Icon d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              <span className="font-semibold">User Help</span>
            </div>
            <p className="text-sm text-(--color-text-muted)">
              The member-facing help page. Useful context when answering user
              questions in #help-ailibrary.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ToolCard({ tool }: { tool: AdminTool }) {
  const isComingSoon = tool.status === "coming_soon";

  const cardClass = `flex h-full flex-col rounded-xl border bg-(--color-surface) p-5 transition-shadow ${
    isComingSoon
      ? "border-dashed border-(--color-border) opacity-70"
      : "border-(--color-border) hover:border-(--color-primary) hover:shadow-sm"
  }`;

  const inner = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-(--color-primary)">
          {tool.icon}
          <h3 className="font-semibold text-(--color-text)">{tool.title}</h3>
        </div>
        {tool.badge ? (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            {tool.badge}
          </span>
        ) : null}
        {isComingSoon ? (
          <span className="rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-xs font-medium text-(--color-text-muted)">
            Coming soon
          </span>
        ) : null}
      </div>
      <p className="text-sm text-(--color-text-muted)">{tool.description}</p>
      {tool.action ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              tool.action?.();
            }}
            disabled={tool.actionDisabled}
            className="inline-flex items-center rounded-lg border border-(--color-primary) px-3 py-1.5 text-sm font-medium text-(--color-primary) hover:bg-(--color-primary)/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tool.actionLabel ?? "Run"}
          </button>
        </div>
      ) : null}
    </>
  );

  if (isComingSoon || !tool.to) {
    return (
      <div className={cardClass} aria-disabled={isComingSoon || undefined}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={tool.to}
      className={`${cardClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)`}
    >
      {inner}
    </Link>
  );
}
