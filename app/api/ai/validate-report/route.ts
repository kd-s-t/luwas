import { NextResponse } from "next/server";
import { validateHazardReport } from "@/lib/ai/validateHazardReport";
import type { ReportHazardHint, ReportMediaType } from "@/lib/reports/types";

export const runtime = "nodejs";

type Body = {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaMime: string;
  /** Base64 without data: prefix — preferred for emulator Storage. */
  mediaBase64?: string;
  fileName?: string;
  model?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const result = await validateHazardReport({
    title,
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
    hazardHint: body.hazardHint ?? "other",
    mediaType: body.mediaType === "video" ? "video" : "photo",
    mediaMime: body.mediaMime || "",
    mediaBase64: body.mediaBase64,
    fileName: body.fileName,
    model: body.model,
  });

  return NextResponse.json(result);
}
