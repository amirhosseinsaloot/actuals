"use client";

import { GridToolbarContainer, GridToolbarQuickFilter } from "@mui/x-data-grid";

// Let `slotProps={{ toolbar: { placeholder } }}` type-check on the DataGrid.
declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides {
    placeholder: string;
  }
}

/**
 * A DataGrid toolbar that shows only MUI's built-in quick-filter search box.
 * It debounces input and, in `filterMode="server"`, emits the typed value via
 * `onFilterModelChange` so we can forward it to the backend `search=` param.
 */
export default function QuickSearchToolbar({
  placeholder,
}: {
  placeholder: string;
}) {
  return (
    <GridToolbarContainer sx={{ p: 1 }}>
      <GridToolbarQuickFilter
        debounceMs={400}
        placeholder={placeholder}
        variant="outlined"
        size="small"
        sx={{ width: { xs: "100%", sm: 320 } }}
      />
    </GridToolbarContainer>
  );
}
