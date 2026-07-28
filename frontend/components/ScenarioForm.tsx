"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

import type { Scenario } from "@/lib/types";
import { useSubmitState } from "@/lib/useSubmitState";

import FormActions from "./FormActions";

interface Props {
  submitLabel: string;
  onSubmit: (data: Partial<Scenario>) => Promise<void>;
  onCancel?: () => void;
  /** Prefill for edit mode; omit for a blank create form. */
  initial?: Pick<Scenario, "name" | "period_start" | "period_end" | "currency">;
}

export default function ScenarioForm({
  submitLabel,
  onSubmit,
  onCancel,
  initial,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [periodStart, setPeriodStart] = useState(
    initial?.period_start ?? "2026-07-01",
  );
  const [periodEnd, setPeriodEnd] = useState(
    initial?.period_end ?? "2026-09-30",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const { busy, error, submit } = useSubmitState();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(() =>
      onSubmit({
        name,
        period_start: periodStart,
        period_end: periodEnd,
        currency,
      }),
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Scenario name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Q3 2026 Operating Budget"
          required
          fullWidth
          size="small"
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Period start"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Period end"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            required
            fullWidth
            size="small"
          />
        </Stack>
        <TextField
          label="Currency"
          value={currency}
          onChange={(event) =>
            setCurrency(event.target.value.toUpperCase().slice(0, 3))
          }
          slotProps={{ htmlInput: { maxLength: 3 } }}
          sx={{ width: 140 }}
          size="small"
        />
        <FormActions
          error={error}
          busy={busy}
          submitLabel={submitLabel}
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}
