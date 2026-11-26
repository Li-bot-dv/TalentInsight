import { NextRequest, NextResponse } from "next/server";
import { getJobs, getSeniorHiringAnalytics } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sector = sp.get("sector") ?? "ALL";
  const seniorOnly = sp.get("seniorOnly") === "true" || sp.get("seniorOnly") === "1";

  const jobs = getJobs({
    sector,
    seniorOnly,
    seniority: sp.get("seniority") ?? "ALL",
    department: sp.get("department") ?? "ALL",
    location: sp.get("location") ?? "ALL",
    source: sp.get("source") ?? "ALL",
    search: sp.get("search") ?? "",
    limit: Number(sp.get("limit") ?? 150),
  });

  const analytics = getSeniorHiringAnalytics(sector);
  return NextResponse.json({ jobs, analytics });
}
