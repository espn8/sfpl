import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { listCollections } from "./api";

export function CollectionDetailPage() {
  const params = useParams();
  const collectionId = Number(params.id);

  const collectionsQuery = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
  });

  if (collectionsQuery.isLoading) {
    return <p>Loading collection...</p>;
  }

  const collection = collectionsQuery.data?.find((item) => item.id === collectionId);
  if (!collection) {
    return <p className="text-red-700">Collection not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{collection.name}</h2>
        <p className="text-slate-600">{collection.description ?? "No description."}</p>
      </div>
      <div className="space-y-2">
        {collection.prompts.length === 0 ? (
          <p className="text-slate-600">No prompts in this collection yet.</p>
        ) : (
          collection.prompts.map((entry) => (
            <Link
              key={entry.prompt.id}
              to={`/prompts/${entry.prompt.id}`}
              className="block rounded border bg-white p-3"
            >
              {entry.prompt.title}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
