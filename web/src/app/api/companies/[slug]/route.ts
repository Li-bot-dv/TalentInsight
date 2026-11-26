import { NextRequest, NextResponse } from "next/server";
import { deleteCompanyBySlug, getCompanyDetail } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const detail = getCompanyDetail(slug);
  if (!detail) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const deleted = deleteCompanyBySlug(slug);
  if (!deleted) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
