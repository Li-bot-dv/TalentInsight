import { NextRequest, NextResponse } from "next/server";
import { createMovement, getMovements } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const movements = getMovements({
    sector: sp.get("sector") ?? "ALL",
    category: sp.get("category") ?? "ALL",
    impact: sp.get("impact") ?? "ALL",
    search: sp.get("search") ?? "",
    limit: Number(sp.get("limit") ?? 80),
  });
  return NextResponse.json({ movements });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.company_id || !body?.title || !body?.summary) {
      return NextResponse.json(
        { error: "company_id, title, and summary are required." },
        { status: 400 }
      );
    }
    const created = createMovement({
      company_id: Number(body.company_id),
      title: String(body.title),
      summary: String(body.summary),
      category: String(body.category || "PRODUCT_TECH"),
      impact: String(body.impact || "NEUTRAL"),
      event_date: body.event_date ? String(body.event_date) : undefined,
      source_name: body.source_name ? String(body.source_name) : "Analyst Note",
      source_url: body.source_url ? String(body.source_url) : "",
    });
    return NextResponse.json({ movement: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save movement";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
