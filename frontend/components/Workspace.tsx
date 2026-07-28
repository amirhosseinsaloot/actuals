"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, getScenario, updateScenario } from "@/lib/api";
import {
  budgetRemainingLabel,
  budgetUsedPct,
  formatPeriod,
  healthTone,
  money,
  planDeviationLabel,
  variancePresentation,
} from "@/lib/format";
import type { Scenario } from "@/lib/types";

import BudgetAssistant from "./BudgetAssistant";
import BudgetUsedBar from "./BudgetUsedBar";
import FormDialog from "./FormDialog";
import HealthChip from "./HealthChip";
import LineItemTable from "./LineItemTable";
import ScenarioForm from "./ScenarioForm";
import StatTile from "./StatTile";

function ScenarioNotFound() {
  return (
    <Paper sx={{ p: 5, textAlign: "center" }}>
      <Typography variant="h6" gutterBottom>
        Scenario not found
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        This scenario doesn’t exist or may have been deleted.
      </Typography>
      <Button variant="contained" component={NextLink} href="/scenarios">
        ← Back to scenarios
      </Button>
    </Paper>
  );
}

/** Breadcrumb, title, period, and health — plain page header, no card. */
function ScenarioDetailHeader({
  scenario,
  onEdit,
}: {
  scenario: Scenario;
  onEdit: () => void;
}) {
  const { health } = scenario;

  return (
    <Box sx={{ mb: 4 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 2, fontSize: 14 }}
      >
        <Link component={NextLink} href="/scenarios" variant="body2">
          All scenarios
        </Link>
        <Typography variant="body2" color="grey.300">
          /
        </Typography>
        <Typography variant="body2" color="text.primary">
          {scenario.name}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
      >
        <Typography variant="h5" sx={{ mb: 1.5 }}>
          {scenario.name}
        </Typography>
        <Button size="small" variant="outlined" onClick={onEdit}>
          Edit
        </Button>
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="body2" className="mono" color="text.secondary">
          {formatPeriod(scenario.period_start, scenario.period_end)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          · {scenario.currency}
        </Typography>
        <HealthChip
          label={health.label}
          tone={healthTone(health.status)}
          size="small"
        />
      </Stack>
    </Box>
  );
}

/** The four headline metric cards: Budget, Actual, Variance, Budget Used. */
function ScenarioMetricCards({ scenario }: { scenario: Scenario }) {
  const currency = scenario.currency;
  const variance = variancePresentation(
    scenario.variance_total ?? "0",
    currency,
  );
  const overUnder = planDeviationLabel(
    scenario.budget_total,
    scenario.actual_total,
  );
  const usedPercent = budgetUsedPct(
    scenario.budget_total,
    scenario.actual_total,
  );
  const { label: usedSub, over: isOver } = budgetRemainingLabel(
    scenario.budget_total,
    scenario.actual_total,
    currency,
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 2,
        mb: 4,
      }}
    >
      <StatTile
        label="Budget"
        value={money(scenario.budget_total ?? "0", currency)}
        sub="Total allocated"
      />
      <StatTile
        label="Actual"
        value={money(scenario.actual_total ?? "0", currency)}
        sub="Current spend"
      />
      <StatTile
        label="Variance"
        value={variance.text}
        color={variance.color}
        sub={overUnder}
      />
      <StatTile
        label="Budget Used"
        value={`${usedPercent.toFixed(1)}%`}
        color={isOver ? "error.main" : undefined}
        sub={usedSub}
      >
        <BudgetUsedBar
          budgetTotal={scenario.budget_total}
          actualTotal={scenario.actual_total}
        />
      </StatTile>
    </Box>
  );
}

/** Loads a scenario and exposes a refresh; distinguishes 404 from other errors. */
function useScenario(scenarioId: number) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setScenario(await getScenario(scenarioId));
      setError(null);
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load scenario.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { scenario, loading, notFound, error, refresh };
}

/** Edit-scenario modal: reuses ScenarioForm, PATCHes, then refreshes. */
function ScenarioEditDialog({
  scenario,
  open,
  onClose,
  onSaved,
}: {
  scenario: Scenario;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <FormDialog open={open} title="Edit scenario" onClose={onClose}>
      <ScenarioForm
        submitLabel="Save changes"
        initial={scenario}
        onSubmit={async (payload) => {
          await updateScenario(scenario.id, payload);
          onSaved();
        }}
        onCancel={onClose}
      />
    </FormDialog>
  );
}

export default function Workspace({ scenarioId }: { scenarioId: number }) {
  const { scenario, loading, notFound, error, refresh } =
    useScenario(scenarioId);
  const [editing, setEditing] = useState(false);

  if (loading) {
    return <Typography color="text.secondary">Loading scenario…</Typography>;
  }
  if (notFound) {
    return <ScenarioNotFound />;
  }
  if (error) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{error}</Alert>
        <Link component={NextLink} href="/scenarios">
          ← Back to scenarios
        </Link>
      </Stack>
    );
  }
  if (!scenario) {
    return null;
  }

  return (
    <Box
      sx={{
        // Desktop: lock to the viewport so the line-item table and the
        // assistant each scroll on their own. Mobile: flow as one column.
        height: { md: "100%" },
        display: "flex",
        flexDirection: "column",
        overflow: { md: "hidden" },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <ScenarioDetailHeader
          scenario={scenario}
          onEdit={() => setEditing(true)}
        />
        <ScenarioMetricCards scenario={scenario} />
      </Box>

      <ScenarioEditDialog
        scenario={scenario}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void refresh();
        }}
      />

      <Box
        sx={{
          flex: { md: 1 },
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" },
          // minmax(0, 1fr) lets the single desktop row fill the pane height
          // (and shrink so each panel's own scroll handles overflow); mobile
          // keeps auto rows that grow with content.
          gridTemplateRows: { md: "minmax(0, 1fr)" },
          gap: 2.5,
          // Grid items default to min-width: auto (content-based), so a wide
          // DataGrid inside LineItemTable can force its track past its fr
          // share. min-width: 0 makes both items honor the fr split and lets
          // each panel's own overflow handle any excess.
          "& > *": { minWidth: 0 },
        }}
      >
        <LineItemTable
          scenarioId={scenarioId}
          currency={scenario.currency}
          onMutated={refresh}
        />
        <BudgetAssistant
          scenarioId={scenarioId}
          scenarioName={scenario.name}
          currency={scenario.currency}
        />
      </Box>
    </Box>
  );
}
