import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "./api";

export function SettingsPage() {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  if (meQuery.isLoading) {
    return <p>Loading settings...</p>;
  }

  if (!meQuery.data) {
    return <p className="text-red-700">Unable to load user profile.</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="rounded border bg-white p-4">
        <p>
          <span className="font-semibold">Name:</span> {meQuery.data.name ?? "Not set"}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {meQuery.data.email}
        </p>
        <p>
          <span className="font-semibold">Role:</span> {meQuery.data.role}
        </p>
        <p>
          <span className="font-semibold">Team ID:</span> {meQuery.data.teamId}
        </p>
      </div>
    </section>
  );
}
