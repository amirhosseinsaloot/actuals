"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

import type { LineItem } from "@/lib/types";
import { useSubmitState } from "@/lib/useSubmitState";

import FormActions from "./FormActions";

interface Props {
  /** When set, the form edits an existing line item. */
  initial?: Partial<LineItem>;
  submitLabel: string;
  onSubmit: (data: Partial<LineItem>) => Promise<void>;
  onCancel?: () => void;
}

const MONEY_INPUT = { step: "0.01", min: "0" };

function MoneyField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required
      fullWidth
      size="small"
      slotProps={{ htmlInput: MONEY_INPUT }}
    />
  );
}

export default function LineItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [budget, setBudget] = useState(initial?.budget_amount ?? "");
  const [actual, setActual] = useState(initial?.actual_amount ?? "");
  const { busy, error, submit } = useSubmitState();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(() =>
      onSubmit({
        department,
        category,
        description,
        budget_amount: budget,
        actual_amount: actual,
      }),
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Marketing"
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Paid Ads"
            required
            fullWidth
            size="small"
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <MoneyField
            label="Budget amount"
            value={budget}
            placeholder="50000.00"
            onChange={setBudget}
          />
          <MoneyField
            label="Actual amount"
            value={actual}
            placeholder="65000.00"
            onChange={setActual}
          />
        </Stack>
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Search & social campaigns"
          fullWidth
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
