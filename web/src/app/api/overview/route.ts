import { NextRequest, NextResponse } from "next/server";
import { getOverviewData } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get("sector") ?? "ALL";
  const data = getOverviewData(sector);
  return NextResponse.json(data);
}
