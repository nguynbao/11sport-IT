import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

interface RevalidatePayload {
  secret?: string;
  tags?: string[];
  paths?: string[];
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, message: "REVALIDATE_SECRET chưa được cấu hình" },
      { status: 500 }
    );
  }

  let body: RevalidatePayload = {};
  try {
    body = (await request.json()) as RevalidatePayload;
  } catch {
    body = {};
  }

  const headerSecret =
    request.headers.get("x-revalidate-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    body.secret;

  if (!headerSecret || headerSecret !== configuredSecret) {
    return NextResponse.json(
      { ok: false, message: "Không có quyền thực hiện revalidate" },
      { status: 401 }
    );
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const paths = Array.isArray(body.paths)
    ? body.paths.filter(
        (p): p is string => typeof p === "string" && p.startsWith("/")
      )
    : [];

  if (tags.length === 0 && paths.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Cần truyền ít nhất một tag hoặc path hợp lệ" },
      { status: 400 }
    );
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    ok: true,
    revalidated: {
      tags,
      paths,
      timestamp: new Date().toISOString(),
    },
  });
}
