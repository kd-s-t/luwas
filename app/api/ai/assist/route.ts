import { NextResponse } from "next/server";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
import { generateWithGeminiFallback } from "@/lib/ai/geminiGenerate";
import { resolveGeminiModel } from "@/lib/ai/geminiModels";
import { runLocalAssist } from "@/lib/ai/localAssist";
import type { AssistResult } from "@/lib/ai/assistTypes";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";
import { NANGKA_SAFE_POINTS } from "@/lib/geo/safePoints";

export const runtime = "nodejs";

type Body = {
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
  model?: string;
};

function withEscapes(
  result: Omit<AssistResult, "escapes"> & { escapes?: AssistResult["escapes"] },
  body: Body,
): AssistResult {
  const escapes = buildEscapeRoutes(
    result.actions,
    body.households,
    body.floods,
    body.landslides,
  );
  return {
    ...result,
    actions: enrichActionsWithContacts(result.actions, body.households),
    escapes,
    mapHint:
      escapes.length > 0
        ? "Escape lines will follow OSM streets to the nearest safe point."
        : result.mapHint,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = resolveGeminiModel(body.model);
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const local = runLocalAssist(body);
    return NextResponse.json({ ...local, model });
  }

  try {
    const compactHouseholds = body.households.map((h) => ({
      id: h.id,
      ownerName: h.ownerName,
      phone: h.phone,
      purok: h.purok,
      notes: h.notes,
      lat: h.lat,
      lng: h.lng,
    }));

    const prompt = `You are a barangay DRRM assistant for Brgy. Nangka, Consolacion, Cebu.
Given hazards and households, return ONLY valid JSON (no markdown) matching:
{
  "summary": string,
  "focusHazard": "flood"|"landslide"|"typhoon"|"earthquake"|"weather"|"mixed",
  "actions": [{"householdId": string, "priority": "evacuate"|"prepare"|"monitor", "reason": string}],
  "mapHint": string
}
Rules: leave actions empty — the server flags EVERY flood/landslide/vulnerable household (no cap). Focus on summary, focusHazard, and mapHint.
Safe points available (server will draw escape arrows): ${JSON.stringify(
      NANGKA_SAFE_POINTS.map((s) => ({ id: s.id, name: s.name })),
    )}

Weather: ${body.weatherLabel ?? "unknown"}
Floods: ${JSON.stringify(body.floods)}
Landslides: ${JSON.stringify(body.landslides)}
Typhoons: ${JSON.stringify(body.typhoons)}
Households: ${JSON.stringify(compactHouseholds)}`;

    const { text, model: usedModel } = await generateWithGeminiFallback(
      key,
      model,
      prompt,
    );

    const local = runLocalAssist(body);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        ...local,
        model: usedModel,
        summary: `${local.summary} (Gemini parse fallback)`,
      });
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<
      AssistResult,
      "source" | "escapes" | "model"
    >;
    const result = withEscapes(
      {
        summary: String(parsed.summary ?? local.summary),
        focusHazard: parsed.focusHazard ?? local.focusHazard,
        actions: local.actions,
        mapHint: String(parsed.mapHint ?? local.mapHint),
        source: "gemini",
        model: usedModel,
      },
      body,
    );
    return NextResponse.json(result);
  } catch {
    const local = runLocalAssist(body);
    return NextResponse.json({
      ...local,
      model,
      summary: `${local.summary} (Gemini unavailable — local assist used.)`,
    });
  }
}
