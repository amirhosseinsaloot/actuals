"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { GridColDef } from "@mui/x-data-grid";
import NextLink from "next/link";
import { useCallback, useState } from "react";

import {
  createScenario,
  deleteScenario,
  listScenarios,
  updateScenario,
} from "@/lib/api";
import {
  formatPeriod,
  healthTone,
  relativeTime,
  variancePresentation,
} from "@/lib/format";
import { usePaginatedList, useServerGridState } from "@/lib/serverGrid";
import type { Scenario } from "@/lib/types";

import BorderedIconButton from "./BorderedIconButton";
import ConfirmDialog from "./ConfirmDialog";
import FormDialog from "./FormDialog";
import HealthChip from "./HealthChip";
import ScenarioForm from "./ScenarioForm";
import ServerDataGrid from "./ServerDataGrid";

function renderName(scenario: Scenario) {
  return (
    <Box sx={{ py: 1 }}>
      <Link
        component={NextLink}
        href={`/scenarios/${scenario.id}`}
        fontWeight={600}
      >
        {scenario.name}
      </Link>
      <Typography variant="caption" color="text.secondary" display="block">
        {scenario.currency} · updated {relativeTime(scenario.updated_at)}
      </Typography>
    </Box>
  );
}

function renderPeriod(scenario: Scenario) {
  return (
    <Typography
      component="span"
      variant="body2"
      className="mono"
      color="text.secondary"
    >
      {formatPeriod(scenario.period_start, scenario.period_end)}
    </Typography>
  );
}

function renderVariance(scenario: Scenario) {
  const variance = variancePresentation(
    scenario.variance_total ?? "0",
    scenario.currency,
  );
  return (
    <Typography
      component="span"
      variant="body2"
      fontWeight={600}
      className="tnum"
      sx={{ color: variance.color }}
    >
      {variance.text}
    </Typography>
  );
}

function renderHealth(scenario: Scenario) {
  const { health } = scenario;
  return (
    <HealthChip
      label={health.label}
      tone={healthTone(health.status)}
      size="small"
    />
  );
}

function renderActions(
  scenario: Scenario,
  onEdit: (row: Scenario) => void,
  onDelete: (row: Scenario) => void,
) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      <Button
        size="small"
        component={NextLink}
        href={`/scenarios/${scenario.id}`}
      >
        Open
      </Button>
      <Tooltip title="Edit scenario">
        <BorderedIconButton onClick={() => onEdit(scenario)}>
          <EditOutlinedIcon fontSize="small" />
        </BorderedIconButton>
      </Tooltip>
      <Tooltip title="Delete scenario">
        <BorderedIconButton color="error" onClick={() => onDelete(scenario)}>
          <DeleteOutlineIcon fontSize="small" />
        </BorderedIconButton>
      </Tooltip>
    </Stack>
  );
}

function buildColumns(
  onEdit: (scenario: Scenario) => void,
  onDelete: (scenario: Scenario) => void,
): GridColDef<Scenario>[] {
  const right = { align: "right", headerAlign: "right" } as const;
  return [
    {
      field: "name",
      headerName: "Scenario",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => renderName(params.row),
    },
    {
      field: "period",
      headerName: "Period",
      flex: 0.9,
      minWidth: 170,
      sortable: false,
      renderCell: (params) => renderPeriod(params.row),
    },
    {
      field: "line_item_count",
      headerName: "Line items",
      flex: 0.4,
      minWidth: 80,
      sortable: false,
      ...right,
    },
    {
      field: "variance_total",
      headerName: "Variance",
      flex: 0.6,
      minWidth: 110,
      sortable: false,
      ...right,
      renderCell: (params) => renderVariance(params.row),
    },
    {
      field: "health",
      headerName: "Health",
      flex: 0.6,
      minWidth: 120,
      sortable: false,
      renderCell: (params) => renderHealth(params.row),
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      renderCell: (params) => renderActions(params.row, onEdit, onDelete),
    },
  ];
}

function NewScenarioDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<Scenario>) => Promise<void>;
}) {
  return (
    <FormDialog open={open} title="New scenario" onClose={onClose}>
      <ScenarioForm
        submitLabel="Create scenario"
        onSubmit={onCreate}
        onCancel={onClose}
      />
    </FormDialog>
  );
}

function EditScenarioDialog({
  target,
  onClose,
  onSave,
}: {
  target: Scenario | null;
  onClose: () => void;
  onSave: (payload: Partial<Scenario>) => Promise<void>;
}) {
  return (
    <FormDialog open={!!target} title="Edit scenario" onClose={onClose}>
      {target && (
        // Keyed by id so switching targets re-initializes the form fields.
        <ScenarioForm
          key={target.id}
          submitLabel="Save changes"
          initial={target}
          onSubmit={onSave}
          onCancel={onClose}
        />
      )}
    </FormDialog>
  );
}

function ScenarioDialogs({
  dialogOpen,
  onCloseDialog,
  onCreate,
  editTarget,
  onCloseEdit,
  onSaveEdit,
  deleteTarget,
  onCancelDelete,
  onConfirmDelete,
}: {
  dialogOpen: boolean;
  onCloseDialog: () => void;
  onCreate: (payload: Partial<Scenario>) => Promise<void>;
  editTarget: Scenario | null;
  onCloseEdit: () => void;
  onSaveEdit: (payload: Partial<Scenario>) => Promise<void>;
  deleteTarget: Scenario | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
}) {
  return (
    <>
      <NewScenarioDialog
        open={dialogOpen}
        onClose={onCloseDialog}
        onCreate={onCreate}
      />
      <EditScenarioDialog
        target={editTarget}
        onClose={onCloseEdit}
        onSave={onSaveEdit}
      />
      <ConfirmDialog
        key={deleteTarget ? `delete-${deleteTarget.id}` : "delete-closed"}
        open={!!deleteTarget}
        title="Delete scenario"
        message={
          deleteTarget
            ? `Delete scenario "${deleteTarget.name}" and all its line items?`
            : ""
        }
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

/** Dialog open/close state and the create/edit/delete API calls. */
function useScenarioMutations(afterMutation: () => Promise<void>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Scenario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);

  async function create(payload: Partial<Scenario>) {
    await createScenario(payload);
    setDialogOpen(false);
    await afterMutation();
  }

  async function update(payload: Partial<Scenario>) {
    if (!editTarget) {
      return;
    }
    await updateScenario(editTarget.id, payload);
    setEditTarget(null);
    await afterMutation();
  }

  async function remove() {
    if (!deleteTarget) {
      return;
    }
    await deleteScenario(deleteTarget.id);
    setDeleteTarget(null);
    await afterMutation();
  }

  return {
    dialogOpen,
    setDialogOpen,
    editTarget,
    setEditTarget,
    deleteTarget,
    setDeleteTarget,
    create,
    update,
    remove,
  };
}

export default function ScenarioList() {
  const grid = useServerGridState([{ field: "created_at", sort: "desc" }]);
  const theme = useTheme();
  const belowMd = useMediaQuery(theme.breakpoints.down("md"));
  const belowSm = useMediaQuery(theme.breakpoints.down("sm"));
  // Narrow screens keep the essentials: name, variance, actions.
  const columnVisibility = {
    period: !belowMd,
    line_item_count: !belowMd,
    health: !belowSm,
  };

  const { data, loading, error, refresh } = usePaginatedList(
    useCallback(
      () =>
        listScenarios({
          page: grid.paginationModel.page + 1,
          page_size: grid.paginationModel.pageSize,
          search: grid.search || undefined,
          ordering: grid.ordering,
        }),
      [grid.paginationModel, grid.search, grid.ordering],
    ),
    "Failed to load scenarios.",
  );

  const mutations = useScenarioMutations(async () => {
    grid.resetPage();
    await refresh();
  });

  const columns = buildColumns(
    mutations.setEditTarget,
    mutations.setDeleteTarget,
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => mutations.setDialogOpen(true)}
        >
          New scenario
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ServerDataGrid<Scenario>
        rows={data?.results ?? []}
        columns={columns}
        rowCount={data?.count ?? 0}
        loading={loading}
        paginationModel={grid.paginationModel}
        onPaginationModelChange={grid.setPaginationModel}
        sortModel={grid.sortModel}
        onSortModelChange={grid.setSortModel}
        onSearchChange={grid.handleSearchChange}
        searchPlaceholder="Search scenarios by name…"
        height={480}
        rowHeight={60}
        columnVisibilityModel={columnVisibility}
      />

      <ScenarioDialogs
        dialogOpen={mutations.dialogOpen}
        onCloseDialog={() => mutations.setDialogOpen(false)}
        onCreate={mutations.create}
        editTarget={mutations.editTarget}
        onCloseEdit={() => mutations.setEditTarget(null)}
        onSaveEdit={mutations.update}
        deleteTarget={mutations.deleteTarget}
        onCancelDelete={() => mutations.setDeleteTarget(null)}
        onConfirmDelete={mutations.remove}
      />
    </Box>
  );
}
