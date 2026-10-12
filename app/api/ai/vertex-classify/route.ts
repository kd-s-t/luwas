import { NextResponse } from "next/server";
import { classifyImageWithVertex } from "@/lib/ai/vertexClassify";

export const runtime = "nodejs";

type Body = {
  mediaBase64?: string;
  imageBase64?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageBase64 =
    (typeof body.mediaBase64 === "string" && body.mediaBase64.trim()) ||
    (typeof body.imageBase64 === "string" && body.imageBase64.trim()) ||
    "";

  if (!imageBase64) {
    return NextResponse.json(
      { error: "mediaBase64 required" },
      { status: 400 },
    );
  }

  const result = await classifyImageWithVertex({ imageBase64 });
  return NextResponse.json(result);
}
