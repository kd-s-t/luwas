import { NextResponse } from "next/server";
import { readActiveEeCacheFile } from "@/lib/geo/eeRunHistory";

export const runtime = "nodejs";

type Params = { params: Promise<{ fileName: string }> };

/** Download the live active EE cache (Firebase Storage, local fallback). */
export async function GET(_req: Request, { params }: Params) {
  const { fileName } = await params;
  const file = await readActiveEeCacheFile(fileName);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
