import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
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

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(runLocalAssist(body));
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const compactHouseholds = body.households.map((h) => ({
      id: h.id,
      ownerName: h.ownerName,
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
Rules: pick at most 10 actions; prioritize evacuate for flood/landslide proximity and vulnerable notes (PWD, elderly, pregnant, infant, no upper floor). Use only household ids from the list.
Safe points available (server will draw escape arrows): ${JSON.stringify(
      NANGKA_SAFE_POINTS.map((s) => ({ id: s.id, name: s.name })),
    )}

Weather: ${body.weatherLabel ?? "unknown"}
Floods: ${JSON.stringify(body.floods)}
Landslides: ${JSON.stringify(body.landslides)}
Typhoons: ${JSON.stringify(body.typhoons)}
Households: ${JSON.stringify(compactHouseholds)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const local = runLocalAssist(body);
      return NextResponse.json({
        ...local,
        summary: `${local.summary} (Gemini parse fallback)`,
      });
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<AssistResult, "source" | "escapes">;
    const result = withEscapes(
      {
        summary: String(parsed.summary ?? "Assist complete."),
        focusHazard: parsed.focusHazard ?? "mixed",
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 10) : [],
        mapHint: String(parsed.mapHint ?? "Map updated with priority homes."),
        source: "gemini",
      },
      body,
    );
    return NextResponse.json(result);
  } catch {
    const local = runLocalAssist(body);
    return NextResponse.json({
      ...local,
      summary: `${local.summary} (Gemini unavailable — local assist used.)`,
    });
  }
}
