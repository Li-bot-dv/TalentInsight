import MarketPulseView, { type OverviewDataset } from "@/components/views/MarketPulseView";
import { getOverviewData, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function MarketPulsePage() {
  const datasets: Record<string, OverviewDataset> = {
    ALL: toPlain(getOverviewData("ALL")),
    TECH: toPlain(getOverviewData("TECH")),
    CFC: toPlain(getOverviewData("CFC")),
    BANKING: toPlain(getOverviewData("BANKING")),
  };
  return <MarketPulseView datasets={datasets} />;
}
