"use client";

import type { GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Paginated } from "./types";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/** Map a DataGrid sort model to DRF's `ordering` query param. */
export function toOrdering(sortModel: GridSortModel): string | undefined {
  if (!sortModel.length) {
    return undefined;
  }
  const { field, sort } = sortModel[0];
  return `${sort === "desc" ? "-" : ""}${field}`;
}

/**
 * State for a server-driven DataGrid: pagination, sorting, and quick-filter
 * search, plus `resetPage` for external filters (chips, create flows) that
 * must jump back to page one.
 */
export function useServerGridState(initialSort: GridSortModel = []) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>(initialSort);
  const [search, setSearch] = useState("");

  function resetPage() {
    setPaginationModel((model) => ({ ...model, page: 0 }));
  }

  // Only reset the page when the search text actually changed, so a repeated
  // filter-model event doesn't trigger a redundant refetch.
  function handleSearchChange(value: string) {
    if (value === search) {
      return;
    }
    setSearch(value);
    resetPage();
  }

  return {
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    search,
    handleSearchChange,
    resetPage,
    ordering: toOrdering(sortModel),
  };
}

export type ServerGridState = ReturnType<typeof useServerGridState>;

/**
 * Fetch one page of a server-driven list, re-fetching whenever the caller's
 * memoized `fetchPage` changes (i.e. whenever its page/sort/filter inputs
 * change). Owns the data/loading/error triple both grids used to duplicate.
 */
export function usePaginatedList<T>(
  fetchPage: () => Promise<Paginated<T>>,
  errorMessage: string,
) {
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic request id: only the newest fetch may write state, so overlapping
  // requests (rapid pagination/sort/filter) can't render stale data out of
  // order. mountedRef guards a resolve that lands after unmount.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const page = await fetchPage();
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setData(page);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : errorMessage);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [fetchPage, errorMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
