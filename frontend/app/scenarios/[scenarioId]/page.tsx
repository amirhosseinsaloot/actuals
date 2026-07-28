import Workspace from "@/components/Workspace";

export default function ScenarioDetailPage({
  params,
}: {
  params: { scenarioId: string };
}) {
  return <Workspace scenarioId={Number(params.scenarioId)} />;
}
