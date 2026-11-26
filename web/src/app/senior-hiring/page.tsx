import SeniorHiringView from "@/components/views/SeniorHiringView";
import { getJobs, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function SeniorHiringPage() {
  const jobs = toPlain(getJobs({ limit: 1000 }));
  return <SeniorHiringView initialJobs={jobs} />;
}
