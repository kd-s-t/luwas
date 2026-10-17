import { NextResponse } from "next/server";
import { generateWithGeminiFallback } from "@/lib/ai/geminiGenerate";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from "@/lib/ai/geminiModels";
import {
  buildLocalAllocationOptions,
  normalizeAllocationOptions,
} from "@/lib/workspace/allocationOptions";
import type { SupplyCommunityRow } from "@/lib/workspace/supplyShortagePlan";

export const runtime = "nodejs";

type Body = {
  availableL: number;
  totalNeededL: number;
  resourceLabel?: string;
  rows: SupplyCommunityRow[];
  model?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const availableL = Math.max(0, Number(body.availableL) || 0);
  const totalNeededL = Math.max(0, Number(body.totalNeededL) || 0);
  const resourceLabel = (body.resourceLabel ?? "Drinking water").trim();
  const local = buildLocalAllocationOptions(
    rows,
    availableL,
    totalNeededL,
    resourceLabel,
  );

  if (rows.length === 0) {
    return NextResponse.json({
      ...local,
      debug: { prompt: null, raw: null, error: null },
    });
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ...local,
      debug: {
        prompt: null,
        raw: null,
        error: "GEMINI_API_KEY not set",
      },
    });
  }

  const model = resolveGeminiModel(body.model ?? DEFAULT_GEMINI_MODEL);
  const compact = rows.map((r) => ({
    reportId: r.reportId,
    community: r.community,
    needL: r.gapL > 0 ? r.gapL : r.needL,
    localStockL: r.localStockL,
    readiness: r.readiness,
    readinessLabel: r.readinessLabel,
  }));

  const prompt = `You are a barangay DRRM logistics assistant in Cebu, Philippines.
Distribute limited ${resourceLabel.toLowerCase()} across sitios. Return ONLY valid JSON (no markdown).

Warehouse available: ${availableL} L
Total community gap/need: ${totalNeededL} L
Communities (JSON):
${JSON.stringify(compact, null, 2)}

Return exactly this shape:
{
  "options": [
    {
      "id": "feasible",
      "title": "Focus on feasible deliveries",
      "blurb": "Prioritize communities with no delivery blockers.",
      "suggested": true,
      "summary": "1-2 sentences on tradeoffs and blockers.",
      "lines": [
        { "reportId": "...", "community": "...", "allocateL": 0 }
      ]
    },
    {
      "id": "even",
      "title": "Share evenly across communities",
      "blurb": "Distribute available supply equally regardless of blockers.",
      "suggested": false,
      "summary": "...",
      "lines": [ { "reportId": "...", "community": "...", "allocateL": 0 } ]
    },
    {
      "id": "need",
      "title": "Prioritize highest need",
      "blurb": "Allocate more to the community with the greatest demand.",
      "suggested": false,
      "summary": "...",
      "lines": [ { "reportId": "...", "community": "...", "allocateL": 0 } ]
    }
  ]
}

Rules:
- Exactly 3 options, first is suggested starting point (feasible deliveries).
- Each option lines MUST include every community from the input.
- allocateL is liters from the warehouse only (integers). Sum of allocateL per option MUST be <= ${availableL}.
- Never allocate more than that community's needL.
- ready = can receive now; access_unknown = conditional; no_transport = prefer 0 on feasible option.
- Summaries must mention blockers plainly.`;

  try {
    const { text, model: usedModel } = await generateWithGeminiFallback(
      key,
      model,
      prompt,
    );
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as unknown;
    const normalized = normalizeAllocationOptions(
      parsed,
      rows,
      availableL,
      totalNeededL,
      resourceLabel,
    );
    if (!normalized) {
      return NextResponse.json({
        ...local,
        source: "local",
        debug: {
          prompt,
          raw: text,
          model: usedModel,
          error: "normalize failed",
        },
      });
    }
    return NextResponse.json({
      ...normalized,
      debug: { prompt, raw: text, model: usedModel },
    });
  } catch (err) {
    console.warn("[allocation-options] Gemini failed", err);
    return NextResponse.json({
      ...local,
      debug: {
        prompt,
        raw: null,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
