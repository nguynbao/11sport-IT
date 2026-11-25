import { NextRequest, NextResponse } from "next/server";
import {
  getPrintersResponsePayload,
  postPrintersResponsePayload,
} from "@/shared/lib/printerServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await getPrintersResponsePayload();
  return NextResponse.json(res.body, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const res = await postPrintersResponsePayload(body);
  return NextResponse.json(res.body, { status: res.status });
}
