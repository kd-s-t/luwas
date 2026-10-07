import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Best-effort client IP for field-report provenance (not for access control). */
export async function GET(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cf = req.headers.get("cf-connecting-ip");
  const raw =
    cf?.trim() ||
    realIp?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    "";

  // Local / emulator often has no useful peer IP on the request.
  const ip = raw && raw !== "::1" && raw !== "127.0.0.1" ? raw : raw || "127.0.0.1";

  return NextResponse.json({ ip });
}
