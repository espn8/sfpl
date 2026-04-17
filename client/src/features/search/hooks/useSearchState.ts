import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { PromptModality, PromptTool } from "../../prompts/api";
import { PROMPT_MODALITY_OPTIONS, PROMPT_TOOL_OPTIONS } from "../../prompts/api";
import { parseNaturalLanguageQuery } from "../api";
import type { ActiveFilter, AssetStatus, AssetTypeFilter, ParsedSearchQuery, SearchFilters, SortOption } from "../types";
import { DEFAULT_FILTERS } from "../types";

const DEBOUNCE_MS = 300;

function isValidTool(value: string): value is PromptTool {
  return PROMPT_TOOL_OPTIONS.includes(value as PromptTool);
}

function isValidModality(value: string): value is PromptModality {
  return PROMPT_MODALITY_OPTIONS.includes(value as PromptModality);
}

function isValidAssetType(value: string): value is AssetTypeFilter {
  return ["all", "prompt", "skill", "context"].includes(value);
}

function isValidSort(value: string): value is SortOption {
  return ["recent", "mostUsed", "topRated", "name", "updatedAt"].includes(value);
}

function isValidStatus(value: string): value is AssetStatus {
  return ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(value);
}

function parseFiltersFromParams(params: URLSearchParams): SearchFilters {
  const q = params.get("q") ?? "";
  const assetTypeParam = params.get("type") ?? params.get("assetType") ?? "all";
  const toolParam = params.get("tool") ?? "";
  const modalityParam = params.get("modality") ?? "";
  const sortParam = params.get("sort") ?? "recent";
  const collectionId = params.get("collectionId") ?? "";
  const mine = params.get("mine") === "true";
  const statusParam = params.get("status") ?? "";

  return {
    q,
    assetType: isValidAssetType(assetTypeParam) ? assetTypeParam : "all",
    tool: isValidTool(toolParam) ? toolParam : "",
    modality: isValidModality(modalityParam) ? modalityParam : "",
    sort: isValidSort(sortParam) ? sortParam : "recent",
    collectionId,
    mine,
    status: isValidStatus(statusParam) ? statusParam : "",
  };
}

function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.assetType !== "all") params.set("type", filters.assetType);
  if (filters.tool) params.set("tool", filters.tool);
  if (filters.modality) params.set("modality", filters.modality);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.collectionId) params.set("collectionId", filters.collectionId);
  if (filters.mine) params.set("mine", "true");
  if (filters.status) params.set("status", filters.status);

  return params;
}

type UseSearchStateOptions = {
  debounceMs?: number;
  syncToUrl?: boolean;
};

type UseSearchStateReturn = {
  filters: SearchFilters;
  debouncedFilters: SearchFilters;
  inputValue: string;
  setInputValue: (value: string) => void;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilter: (key: keyof SearchFilters) => void;
  clearAllFilters: () => void;
  activeFilters: ActiveFilter[];
  setPage: (page: number) => void;
  page: number;
  parseAndApplyNaturalLanguage: (query: string) => Promise<void>;
  isParsing: boolean;
};

export function useSearchState(options: UseSearchStateOptions = {}): UseSearchStateReturn {
  const { debounceMs = DEBOUNCE_MS, syncToUrl = true } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilters = useMemo(() => parseFiltersFromParams(searchParams), []);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<SearchFilters>(initialFilters);
  const [inputValue, setInputValueState] = useState(initialFilters.q);
  const [page, setPageState] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (syncToUrl) {
      const newParams = filtersToParams(filters);
      if (page > 1) newParams.set("page", String(page));
      setSearchParams(newParams, { replace: true });
    }
  }, [filters, page, setSearchParams, syncToUrl]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, debounceMs]);

  const setInputValue = useCallback((value: string) => {
    setInputValueState(value);
    setFilters((prev) => ({ ...prev, q: value }));
    setPageState(1);
  }, []);

  const setFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "q") {
      setInputValueState(value as string);
    }
    setPageState(1);
  }, []);

  const clearFilter = useCallback((key: keyof SearchFilters) => {
    setFilters((prev) => ({ ...prev, [key]: DEFAULT_FILTERS[key] }));
    if (key === "q") {
      setInputValueState("");
    }
    setPageState(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setInputValueState("");
    setPageState(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const [isParsing, setIsParsing] = useState(false);

  const parseAndApplyNaturalLanguage = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setIsParsing(true);
    try {
      const parsed = await parseNaturalLanguageQuery(query);
      applyParsedQuery(parsed);
    } catch {
      setInputValueState(query);
      setFilters((prev) => ({ ...prev, q: query }));
    } finally {
      setIsParsing(false);
    }
  }, []);

  function applyParsedQuery(parsed: ParsedSearchQuery) {
    const newFilters: SearchFilters = { ...DEFAULT_FILTERS };

    if (parsed.tool) {
      newFilters.tool = parsed.tool as SearchFilters["tool"];
    }
    if (parsed.assetType) {
      newFilters.assetType = parsed.assetType as SearchFilters["assetType"];
    }
    if (parsed.modality) {
      newFilters.modality = parsed.modality as SearchFilters["modality"];
    }
    if (parsed.searchTerms) {
      newFilters.q = parsed.searchTerms;
    }

    setFilters(newFilters);
    setInputValueState(parsed.searchTerms);
    setPageState(1);
  }

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const result: ActiveFilter[] = [];

    if (filters.assetType !== "all") {
      const labels: Record<string, string> = {
        prompt: "Prompts",
        skill: "Skills",
        context: "Context",
      };
      result.push({
        key: "assetType",
        value: filters.assetType,
        label: labels[filters.assetType] ?? filters.assetType,
      });
    }

    if (filters.tool) {
      const toolLabels: Record<string, string> = {
        chatgpt: "ChatGPT",
        claude_code: "Claude Code",
        claude_cowork: "Claude Cowork",
        cursor: "Cursor",
        gemini: "Gemini",
        meshmesh: "MeshMesh",
        notebooklm: "NotebookLM",
        other: "Other",
        saleo: "Saleo",
        slackbot: "Slackbot",
      };
      result.push({
        key: "tool",
        value: filters.tool,
        label: toolLabels[filters.tool] ?? filters.tool,
      });
    }

    if (filters.modality) {
      const modalityLabels: Record<string, string> = {
        text: "Text",
        code: "Code",
        image: "Image",
        video: "Video",
        audio: "Audio",
        multimodal: "Multimodal",
      };
      result.push({
        key: "modality",
        value: filters.modality,
        label: modalityLabels[filters.modality] ?? filters.modality,
      });
    }

    if (filters.mine) {
      result.push({
        key: "mine",
        value: "true",
        label: "My Assets",
      });
    }

    if (filters.status) {
      const statusLabels: Record<string, string> = {
        DRAFT: "Draft",
        PUBLISHED: "Published",
        ARCHIVED: "Archived",
      };
      result.push({
        key: "status",
        value: filters.status,
        label: statusLabels[filters.status] ?? filters.status,
      });
    }

    return result;
  }, [filters]);

  return {
    filters,
    debouncedFilters,
    inputValue,
    setInputValue,
    setFilter,
    clearFilter,
    clearAllFilters,
    activeFilters,
    setPage,
    page,
    parseAndApplyNaturalLanguage,
    isParsing,
  };
}
