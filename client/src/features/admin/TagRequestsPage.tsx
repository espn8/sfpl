import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  listTagRequests,
  reviewTagRequest,
  type TagRequest,
  type TagRequestStatus,
} from "../tags/api";

const STATUS_LABELS: Record<TagRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
  ON_HOLD: "On Hold",
};

const STATUS_COLORS: Record<TagRequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
  ON_HOLD: "bg-gray-100 text-gray-800",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ReviewModalProps = {
  request: TagRequest;
  onClose: () => void;
  onSuccess: () => void;
};

function ReviewModal({ request, onClose, onSuccess }: ReviewModalProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"APPROVED" | "DECLINED" | "ON_HOLD">("APPROVED");
  const [notes, setNotes] = useState("");

  const reviewMutation = useMutation({
    mutationFn: () => reviewTagRequest(request.id, { status, reviewNotes: notes || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tag-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      onSuccess();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
        <h2 className="text-xl font-semibold">Review Tag Request</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Requested tag: <span className="font-medium">{request.requestedName}</span>
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium">Description</dt>
                <dd className="whitespace-pre-wrap">{request.description ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium">Submitted By</dt>
                <dd>
                  {request.submitterFirstName} {request.submitterLastName} ({request.submitterEmail})
                </dd>
              </div>
              <div>
                <dt className="font-medium">Submitted At</dt>
                <dd>{formatDate(request.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <fieldset className="text-sm">
            <legend className="mb-2 font-medium">Decision</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tag-req-status"
                  checked={status === "APPROVED"}
                  onChange={() => setStatus("APPROVED")}
                  className="h-4 w-4"
                />
                <span className="text-green-700">Approve (creates global tag)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tag-req-status"
                  checked={status === "DECLINED"}
                  onChange={() => setStatus("DECLINED")}
                  className="h-4 w-4"
                />
                <span className="text-red-700">Decline</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tag-req-status"
                  checked={status === "ON_HOLD"}
                  onChange={() => setStatus("ON_HOLD")}
                  className="h-4 w-4"
                />
                <span className="text-gray-700">On Hold</span>
              </label>
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Review Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about your decision..."
              rows={3}
              className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            />
          </label>

          {reviewMutation.isError ? (
            <p className="text-sm text-red-600">Failed to submit review. The tag may already exist.</p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-(--color-border) pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm hover:bg-(--color-surface-muted)"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className="rounded bg-(--color-primary) px-4 py-2 text-sm text-(--color-text-inverse) hover:bg-(--color-primary-active) disabled:opacity-60"
            >
              {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TagRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<TagRequestStatus | "">("");
  const [page, setPage] = useState(1);
  const [reviewingRequest, setReviewingRequest] = useState<TagRequest | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["tag-requests", statusFilter, page],
    queryFn: () =>
      listTagRequests({
        status: statusFilter || undefined,
        page,
        pageSize: 20,
      }),
  });

  return (
    <div className="space-y-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 rounded text-sm text-(--color-text-muted) hover:text-(--color-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
      >
        ← Admin Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Tag Requests</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">Review requests for new global tags.</p>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span>Filter by status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as TagRequestStatus | "");
              setPage(1);
            }}
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DECLINED">Declined</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </label>
      </div>

      {requestsQuery.isLoading ? (
        <p className="text-sm text-(--color-text-muted)">Loading requests...</p>
      ) : requestsQuery.isError ? (
        <p className="text-sm text-red-600">Failed to load requests. Please try again.</p>
      ) : !requestsQuery.data?.data.length ? (
        <div className="rounded border border-(--color-border) bg-(--color-surface-muted) p-8 text-center">
          <p className="text-(--color-text-muted)">No tag requests found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-(--color-border)">
            <table className="w-full text-sm">
              <thead className="bg-(--color-surface-muted)">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tag Name</th>
                  <th className="px-4 py-3 text-left font-medium">Submitter</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {requestsQuery.data.data.map((request) => (
                  <tr key={request.id} className="bg-(--color-surface)">
                    <td className="px-4 py-3 font-medium">{request.requestedName}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p>
                          {request.submitterFirstName} {request.submitterLastName}
                        </p>
                        <p className="text-xs text-(--color-text-muted)">{request.submitterEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-(--color-text-muted)">{formatDate(request.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[request.status]}`}
                      >
                        {STATUS_LABELS[request.status]}
                      </span>
                      {request.reviewedBy && request.reviewedAt ? (
                        <p className="mt-1 text-xs text-(--color-text-muted)">
                          by {request.reviewedBy.name ?? request.reviewedBy.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setReviewingRequest(request)}
                        className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs hover:bg-(--color-surface-muted)"
                      >
                        {request.status === "PENDING" ? "Review" : "Update"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requestsQuery.data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-(--color-text-muted)">
                Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, requestsQuery.data.meta.total)} of{" "}
                {requestsQuery.data.meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(requestsQuery.data.meta.totalPages, p + 1))}
                  disabled={page === requestsQuery.data.meta.totalPages}
                  className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {reviewingRequest ? (
        <ReviewModal
          request={reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          onSuccess={() => setReviewingRequest(null)}
        />
      ) : null}
    </div>
  );
}
