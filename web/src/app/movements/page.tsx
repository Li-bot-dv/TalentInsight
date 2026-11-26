import MovementsView from "@/components/views/MovementsView";
import { getCompaniesVelocity, getMovements, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function CompanyMovementsPage() {
  const movements = toPlain(getMovements({ limit: 150 }));
  const companies = toPlain(getCompaniesVelocity());
  return <MovementsView initialMovements={movements} companies={companies} />;
}
