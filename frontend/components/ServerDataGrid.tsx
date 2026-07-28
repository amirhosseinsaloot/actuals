"use client";

import Box from "@mui/material/Box";
import {
  DataGrid,
  type DataGridProps,
  type GridFilterModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";

import { PAGE_SIZE_OPTIONS } from "@/lib/serverGrid";
import { toSxArray } from "@/lib/sx";

import QuickSearchToolbar from "./QuickSearchToolbar";

// Module-scope so the toolbar's identity is stable across renders — an inline
// slots object would remount the quick-filter input and drop focus per keystroke.
const SLOTS = { toolbar: QuickSearchToolbar };

const BASE_SX = {
  bgcolor: "background.paper",
  borderRadius: 1.5,
  borderColor: "divider",
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: "grey.50",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: "grey.200",
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "grey.600",
  },
  "& .MuiDataGrid-cell": {
    borderBottomColor: "grey.100",
    fontSize: 14,
  },
  "& .MuiDataGrid-row:hover": {
    bgcolor: "grey.50",
  },
  "& .MuiDataGrid-toolbarContainer": {
    p: 2,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "grey.200",
  },
  "& .MuiDataGrid-footerContainer": {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "grey.200",
    color: "grey.600",
    fontSize: 14,
  },
} as const;

interface ServerDataGridProps<R extends GridValidRowModel> extends Pick<
  DataGridProps<R>,
  | "rows"
  | "columns"
  | "rowCount"
  | "loading"
  | "paginationModel"
  | "onPaginationModelChange"
  | "sortModel"
  | "onSortModelChange"
  | "rowHeight"
  | "getRowHeight"
  | "columnVisibilityModel"
  | "sx"
> {
  /** Receives the quick-filter text (debounced by the toolbar). */
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Fixed height of the grid container. Ignored when `fill` is set. */
  height?: number;
  /** Grow to fill a flex parent instead of using `height`. Requires a
   *  height-bounded ancestor (e.g. a flex column with a definite height). */
  fill?: boolean;
}

/**
 * DataGrid preset for this app's server-driven tables: server pagination,
 * sorting, and quick-filter search wired to callbacks, with shared page-size
 * options and header styling. Column definitions stay with the callers.
 */
export default function ServerDataGrid<R extends GridValidRowModel>({
  onSearchChange,
  searchPlaceholder,
  height,
  fill,
  sx,
  ...gridProps
}: ServerDataGridProps<R>) {
  function handleFilterModelChange(model: GridFilterModel) {
    onSearchChange((model.quickFilterValues ?? []).join(" ").trim());
  }

  return (
    <Box
      sx={
        fill
          ? { flex: 1, minHeight: 0, width: "100%" }
          : { height, width: "100%" }
      }
    >
      <DataGrid<R>
        {...gridProps}
        paginationMode="server"
        sortingMode="server"
        filterMode="server"
        onFilterModelChange={handleFilterModelChange}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        disableColumnMenu
        disableRowSelectionOnClick
        slots={SLOTS}
        slotProps={{ toolbar: { placeholder: searchPlaceholder } }}
        sx={[BASE_SX, ...toSxArray(sx)]}
      />
    </Box>
  );
}
