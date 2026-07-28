import Typography from "@mui/material/Typography";

import ScenarioList from "@/components/ScenarioList";

export default function ScenariosPage() {
  return (
    <>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Budget Scenarios
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, fontSize: 16 }}>
        Create a scenario, add line items, then ask the assistant to analyze it.
      </Typography>
      <ScenarioList />
    </>
  );
}
