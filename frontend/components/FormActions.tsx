"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

/** Error alert + submit/cancel row shared by the create/edit forms. */
export default function FormActions({
  error,
  busy,
  submitLabel,
  onCancel,
}: {
  error: string | null;
  busy: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </Stack>
    </>
  );
}
