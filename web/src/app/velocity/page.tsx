import VelocityRadarView from "@/components/views/VelocityRadarView";
import { getCompaniesVelocity, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function VelocityRadarPage() {
  const companies = toPlain(getCompaniesVelocity());
  return <VelocityRadarView initialCompanies={companies} />;
}
