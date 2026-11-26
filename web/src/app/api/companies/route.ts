import { NextRequest, NextResponse } from "next/server";
import { createCompany, getCompaniesVelocity } from "@/lib/db";
import type { Sector } from "@/lib/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const companies = getCompaniesVelocity({
    sector: sp.get("sector") ?? "ALL",
    status: sp.get("status") ?? "ALL",
    search: sp.get("search") ?? "",
  });
  return NextResponse.json({ companies });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.name || !["TECH", "CFC", "BANKING"].includes(body?.sector)) {
      return NextResponse.json(
        { error: "Company name and valid sector (TECH, CFC, BANKING) are required." },
        { status: 400 }
      );
    }
    const created = createCompany({
      name: String(body.name),
      short_name: body.short_name ? String(body.short_name) : undefined,
      sector: body.sector as Sector,
      sub_sector: body.sub_sector ? String(body.sub_sector) : "",
      hq_city: body.hq_city ? String(body.hq_city) : "Ho Chi Minh City",
      headcount_band: body.headcount_band ? String(body.headcount_band) : "1,000-5,000",
      website_url: body.website_url ? String(body.website_url) : "",
      careers_url: body.careers_url ? String(body.careers_url) : "",
      ats_type: body.ats_type ? String(body.ats_type) : "custom",
      ats_board_token: body.ats_board_token ? String(body.ats_board_token) : "",
    });
    return NextResponse.json({ company: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create company";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
