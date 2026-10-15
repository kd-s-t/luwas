import { NextResponse } from "next/server";
import { readEeRunFile } from "@/lib/geo/eeRunHistory";

export const runtime = "nodejs";

type Params = { params: Promise<{ runId: string; fileName: string }> };

/** Download a JSON file from a past Earth Engine run (Firebase Storage). */
export async function GET(_req: Request, { params }: Params) {
  const { runId, fileName } = await params;
  const file = await readEeRunFile(runId, fileName);
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
