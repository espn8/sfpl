import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addPromptToCollection, removePromptFromCollection, type Collection } from "../collections/api";

type UsePromptCollectionMutationsOptions = {
  promptId: number;
  promptTitle?: string;
};

export function usePromptCollectionMutations({ promptId, promptTitle }: UsePromptCollectionMutationsOptions) {
  const queryClient = useQueryClient();

  const addToCollectionMutation = useMutation({
    mutationFn: (collectionId: number) => addPromptToCollection(collectionId, promptId),
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) =>
          collection.id !== collectionId || collection.prompts.some((entry) => entry.prompt.id === promptId)
            ? collection
            : {
                ...collection,
                prompts: [
                  ...collection.prompts,
                  { prompt: { id: promptId, title: promptTitle ?? "Prompt" } },
                ],
              },
        ),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const removeFromCollectionMutation = useMutation({
    mutationFn: (collectionId: number) => removePromptFromCollection(collectionId, promptId),
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) =>
          collection.id !== collectionId
            ? collection
            : {
                ...collection,
                prompts: collection.prompts.filter((entry) => entry.prompt.id !== promptId),
              },
        ),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return { addToCollectionMutation, removeFromCollectionMutation };
}
