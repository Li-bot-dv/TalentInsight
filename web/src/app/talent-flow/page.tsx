import TalentFlowView, { type TalentFlowDataset } from "@/components/views/TalentFlowView";
import { getTalentFlowData, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function TalentFlowPage() {
  const sectors = ["ALL", "TECH", "CFC", "BANKING"];
  const datasets: Record<string, TalentFlowDataset> = {};
  for (const sector of sectors) {
    datasets[`${sector}:all`] = toPlain(getTalentFlowData({ sector, seniorOnly: false }));
    datasets[`${sector}:senior`] = toPlain(getTalentFlowData({ sector, seniorOnly: true }));
  }
  return <TalentFlowView datasets={datasets} />;
}
