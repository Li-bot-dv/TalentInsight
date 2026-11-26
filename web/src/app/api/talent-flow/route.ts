import { NextRequest, NextResponse } from "next/server";
import { getTalentFlowData } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const data = getTalentFlowData({
    sector: sp.get("sector") ?? "ALL",
    seniorOnly: sp.get("seniorOnly") === "true" || sp.get("seniorOnly") === "1",
  });
  return NextResponse.json(data);
}
