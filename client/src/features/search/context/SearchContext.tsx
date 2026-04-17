import { createContext, useContext, type ReactNode } from "react";

type SearchContextValue = {
  highlightQuery: string;
};

const SearchContext = createContext<SearchContextValue>({ highlightQuery: "" });

export function SearchProvider({
  highlightQuery,
  children,
}: {
  highlightQuery: string;
  children: ReactNode;
}) {
  return (
    <SearchContext.Provider value={{ highlightQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext(): SearchContextValue {
  return useContext(SearchContext);
}
