import CrawlersView from "@/components/views/CrawlersView";
import { getCrawlerStatus, toPlain } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function CrawlersAndWatchlistPage() {
  const status = toPlain(getCrawlerStatus());
  return <CrawlersView initialData={status} />;
}
