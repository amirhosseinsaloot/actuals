"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { GridColDef } from "@mui/x-data-grid";
import { useCallback, useEffect, useState } from "react";

import {
  createLineItem,
  deleteLineItem,
  listLineItems,
  updateLineItem,
} from "@/lib/api";
import { money, overUnderLabel, variancePresentation } from "@/lib/format";
import type { ServerGridState } from "@/lib/serverGrid";
import { usePaginatedList, useServerGridState } from "@/lib/serverGrid";
import type { LineItem } from "@/lib/types";

import BorderedIconButton from "./BorderedIconButton";
import ConfirmDialog from "./ConfirmDialog";
import FormDialog from "./FormDialog";
import LineItemForm from "./LineItemForm";
import ServerDataGrid from "./ServerDataGrid";

interface Props {
  scenarioId: number;
  currency: string;
  /** Called after any create/update/delete so the parent can refresh totals. */
  onMutated: () => void;
}

type OverBudget = "" | "true" | "false";

interface ItemCounts {
  all: number;
  over: number;
}

/** Counts for the filter chips (all / over budget), respecting the search. */
function useLineItemCounts(
  scenarioId: number,
  search: string,
  version: number,
): ItemCounts | null {
  const [counts, setCounts] = useState<ItemCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    const shared = { search: search || undefined, page_size: 1 };
    Promise.all([
      listLineItems(scenarioId, shared),
      listLineItems(scenarioId, { ...shared, over_budget: true }),
    ])
      .then(([all, over]) => {
        if (!cancelled) {
          setCounts({ all: all.count, over: over.count });
        }
      })
      .catch(() => {
        /* counts are cosmetic; the grid shows its own errors */
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, search, version]);

  return counts;
}

/** Dialog open/close state and the create/update/delete API calls. */
function useLineItemMutations(
  scenarioId: number,
  afterMutation: (options: { resetPage: boolean }) => Promise<void>,
) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<LineItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<LineItem | null>(null);

  async function create(payload: Partial<LineItem>) {
    await createLineItem(scenarioId, payload);
    setAddOpen(false);
    await afterMutation({ resetPage: true });
  }

  async function update(payload: Partial<LineItem>) {
    if (!editItem) {
      return;
    }
    await updateLineItem(editItem.id, payload);
    setEditItem(null);
    await afterMutation({ resetPage: false });
  }

  async function remove() {
    if (!deleteItem) {
      return;
    }
    await deleteLineItem(deleteItem.id);
    setDeleteItem(null);
    await afterMutation({ resetPage: false });
  }

  return {
    addOpen,
    setAddOpen,
    editItem,
    setEditItem,
    deleteItem,
    setDeleteItem,
    create,
    update,
    remove,
  };
}

function OverBudgetChips({
  value,
  counts,
  onChange,
}: {
  value: OverBudget;
  counts: ItemCounts | null;
  onChange: (value: OverBudget) => void;
}) {
  const chip = (chipValue: OverBudget, label: string, count: number | null) => (
    <Chip
      label={count == null ? label : `${label} ${count}`}
      size="small"
      onClick={() => onChange(chipValue)}
      color={value === chipValue ? "primary" : "default"}
      variant={value === chipValue ? "filled" : "outlined"}
    />
  );
  const onTrack = counts ? counts.all - counts.over : null;

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ mb: 2 }}
      flexWrap="wrap"
      useFlexGap
    >
      {chip("", "All", counts?.all ?? null)}
      {chip("true", "Over budget", counts?.over ?? null)}
      {chip("false", "On track", onTrack)}
    </Stack>
  );
}

function LineItemDialog({
  open,
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: Partial<LineItem>;
  onSubmit: (payload: Partial<LineItem>) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <FormDialog open={open} title={title} onClose={onClose}>
      <LineItemForm
        initial={initial}
        submitLabel={submitLabel}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </FormDialog>
  );
}

function renderCategory(item: LineItem) {
  return (
    <Box>
      <div>{item.category}</div>
      {item.description && (
        <Typography variant="caption" color="text.secondary">
          {item.description}
        </Typography>
      )}
    </Box>
  );
}

function renderVariance(item: LineItem, currency: string) {
  const variance = variancePresentation(item.variance, currency);
  const label = overUnderLabel(item.variance_percent);
  return (
    <Box sx={{ textAlign: "right", width: "100%" }}>
      <Typography
        variant="body2"
        fontWeight={600}
        className="tnum"
        sx={{ color: variance.color }}
      >
        {variance.text}
      </Typography>
      {label && (
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
      )}
    </Box>
  );
}

function renderActions(
  item: LineItem,
  onEdit: (item: LineItem) => void,
  onDelete: (item: LineItem) => void,
) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      <Tooltip title="Edit">
        <BorderedIconButton onClick={() => onEdit(item)}>
          <EditOutlinedIcon fontSize="small" />
        </BorderedIconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <BorderedIconButton color="error" onClick={() => onDelete(item)}>
          <DeleteOutlineIcon fontSize="small" />
        </BorderedIconButton>
      </Tooltip>
    </Stack>
  );
}

function buildColumns({
  currency,
  onEdit,
  onDelete,
}: {
  currency: string;
  onEdit: (item: LineItem) => void;
  onDelete: (item: LineItem) => void;
}): GridColDef<LineItem>[] {
  const right = { align: "right", headerAlign: "right" } as const;
  const asMoney = (value: string) => (
    <span className="tnum">{money(value, currency)}</span>
  );
  return [
    { field: "department", headerName: "Department", flex: 1, minWidth: 100 },
    {
      field: "category",
      headerName: "Category",
      flex: 1.3,
      minWidth: 130,
      renderCell: (params) => renderCategory(params.row),
    },
    {
      field: "budget_amount",
      headerName: "Budget",
      flex: 0.7,
      minWidth: 90,
      ...right,
      renderCell: (params) => asMoney(params.row.budget_amount),
    },
    {
      field: "actual_amount",
      headerName: "Actual",
      flex: 0.7,
      minWidth: 90,
      ...right,
      renderCell: (params) => asMoney(params.row.actual_amount),
    },
    {
      field: "variance",
      headerName: "Variance",
      flex: 0.9,
      minWidth: 110,
      sortable: false,
      ...right,
      renderCell: (params) => renderVariance(params.row, currency),
    },
    {
      field: "actions",
      headerName: "",
      width: 90,
      sortable: false,
      renderCell: (params) => renderActions(params.row, onEdit, onDelete),
    },
  ];
}

type PageQuery = Pick<
  ServerGridState,
  "paginationModel" | "ordering" | "search"
>;

function fetchLineItemsPage(
  scenarioId: number,
  { paginationModel, ordering, search }: PageQuery,
  overBudget: OverBudget,
) {
  return listLineItems(scenarioId, {
    page: paginationModel.page + 1,
    page_size: paginationModel.pageSize,
    ordering,
    search: search || undefined,
    over_budget: overBudget === "" ? undefined : overBudget === "true",
  });
}

function TableHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      spacing={1}
      sx={{ pb: 2, mb: 2, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Typography variant="h6">Budget line items</Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        onClick={onAdd}
      >
        Add
      </Button>
    </Stack>
  );
}

function LineItemDialogs({
  mutations,
}: {
  mutations: ReturnType<typeof useLineItemMutations>;
}) {
  return (
    <>
      <LineItemDialog
        open={mutations.addOpen}
        title="Add line item"
        submitLabel="Add line item"
        onSubmit={mutations.create}
        onClose={() => mutations.setAddOpen(false)}
      />
      <LineItemDialog
        open={!!mutations.editItem}
        title="Edit line item"
        submitLabel="Save changes"
        initial={mutations.editItem ?? undefined}
        onSubmit={mutations.update}
        onClose={() => mutations.setEditItem(null)}
      />
      <ConfirmDialog
        key={
          mutations.deleteItem
            ? `delete-${mutations.deleteItem.id}`
            : "delete-closed"
        }
        open={!!mutations.deleteItem}
        title="Delete line item"
        message={
          mutations.deleteItem
            ? `Delete ${mutations.deleteItem.department} / ${mutations.deleteItem.category}?`
            : ""
        }
        onCancel={() => mutations.setDeleteItem(null)}
        onConfirm={mutations.remove}
      />
    </>
  );
}

const GRID_CELL_SX = {
  "& .MuiDataGrid-cell": {
    py: 1.25,
    display: "flex",
    alignItems: "center",
  },
};

// Desktop fills the pane so the grid can scroll on its own; mobile keeps its
// natural height and scrolls with the page.
const PANEL_SX = {
  p: 2,
  height: { md: "100%" },
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
} as const;

export default function LineItemTable({
  scenarioId,
  currency,
  onMutated,
}: Props) {
  const [overBudget, setOverBudget] = useState<OverBudget>("");
  const [mutationSeq, setMutationSeq] = useState(0);
  const grid = useServerGridState();
  const counts = useLineItemCounts(scenarioId, grid.search, mutationSeq);
  const { paginationModel, ordering, search } = grid;
  const theme = useTheme();
  const belowSm = useMediaQuery(theme.breakpoints.down("sm"));
  const belowMd = useMediaQuery(theme.breakpoints.down("md"));
  // Phones keep the essentials: department, category, variance, actions.
  const columnVisibility = {
    budget_amount: !belowSm,
    actual_amount: !belowSm,
  };

  const { data, loading, error, refresh } = usePaginatedList(
    useCallback(
      () =>
        fetchLineItemsPage(
          scenarioId,
          { paginationModel, ordering, search },
          overBudget,
        ),
      [scenarioId, paginationModel, ordering, search, overBudget],
    ),
    "Failed to load line items.",
  );

  const mutations = useLineItemMutations(scenarioId, async ({ resetPage }) => {
    if (resetPage) {
      grid.resetPage();
    }
    setMutationSeq((sequence) => sequence + 1);
    await refresh();
    onMutated();
  });

  const columns = buildColumns({
    currency,
    onEdit: mutations.setEditItem,
    onDelete: mutations.setDeleteItem,
  });

  return (
    <Paper sx={PANEL_SX}>
      <TableHeader onAdd={() => mutations.setAddOpen(true)} />

      <OverBudgetChips
        value={overBudget}
        counts={counts}
        onChange={(value) => {
          setOverBudget(value);
          grid.resetPage();
        }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ServerDataGrid<LineItem>
        rows={data?.results ?? []}
        columns={columns}
        rowCount={data?.count ?? 0}
        loading={loading}
        paginationModel={grid.paginationModel}
        onPaginationModelChange={grid.setPaginationModel}
        sortModel={grid.sortModel}
        onSortModelChange={grid.setSortModel}
        onSearchChange={grid.handleSearchChange}
        searchPlaceholder="Search department, category…"
        fill={!belowMd}
        height={470}
        getRowHeight={() => "auto"}
        columnVisibilityModel={columnVisibility}
        sx={GRID_CELL_SX}
      />

      <LineItemDialogs mutations={mutations} />
    </Paper>
  );
}
