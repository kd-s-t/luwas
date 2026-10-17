import { NextResponse } from "next/server";
import { gcsGetObject } from "@/lib/storage/gcsAdmin";

export const runtime = "nodejs";

type Params = { params: Promise<{ path: string[] }> };

/** Proxy private GCS report media for <img> (custom bucket has no Firebase tokens). */
export async function GET(_req: Request, { params }: Params) {
  const { path } = await params;
  const objectPath = path.map((p) => decodeURIComponent(p)).join("/");
  const allowed =
    objectPath.startsWith("reports/") ||
    objectPath.startsWith("support/") ||
    objectPath.startsWith("inventory/");
  if (!allowed || objectPath.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const obj = await gcsGetObject(objectPath);
  if (!obj) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
