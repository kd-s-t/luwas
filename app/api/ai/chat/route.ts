import { NextResponse } from "next/server";
import {
  enrichActionsWithContacts,
  formatAssistCallReply,
} from "@/lib/ai/callList";
import { buildEscapeRoutes } from "@/lib/ai/escapeRoutes";
import type { AssistResult } from "@/lib/ai/assistTypes";
import type { ChatApiResponse } from "@/lib/ai/chatTypes";
import { generateWithGeminiFallback } from "@/lib/ai/geminiGenerate";
import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from "@/lib/ai/geminiModels";
import { runLocalAssist } from "@/lib/ai/localAssist";
import { runLocalChat } from "@/lib/ai/localChat";
import { NANGKA_SAFE_POINTS } from "@/lib/geo/safePoints";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

export const runtime = "nodejs";

type HistoryTurn = { role: "user" | "assistant"; content: string };

type Body = {
  message: string;
  history?: HistoryTurn[];
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
  model?: string;
};

type GeminiChatPayload = {
  reply: string;
  updateMap: boolean;
  summary?: string;
  focusHazard?: AssistResult["focusHazard"];
  actions?: AssistResult["actions"];
  mapHint?: string;
};

function withEscapes(
  partial: Omit<AssistResult, "escapes" | "source" | "model"> & {
    source: AssistResult["source"];
    model?: string;
  },
  body: Body,
): AssistResult {
  const escapes = buildEscapeRoutes(
    partial.actions,
    body.households,
    body.floods,
    body.landslides,
  );
  const actions = enrichActionsWithContacts(partial.actions, body.households);
  return {
    ...partial,
    actions,
    escapes,
    mapHint:
      escapes.length > 0
        ? "Escape lines will follow OSM streets to the nearest safe point."
        : partial.mapHint,
  };
}

function parseGeminiJson(text: string): GeminiChatPayload | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as GeminiChatPayload;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const situation = {
    households: body.households ?? [],
    floods: body.floods ?? [],
    landslides: body.landslides ?? [],
    typhoons: body.typhoons ?? [],
    weatherLabel: body.weatherLabel,
  };

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(runLocalChat(message, situation));
  }

  const model = resolveGeminiModel(body.model ?? DEFAULT_GEMINI_MODEL);
  const history = (body.history ?? []).slice(-8);
  const compactHouseholds = situation.households.map((h) => ({
    id: h.id,
    ownerName: h.ownerName,
    phone: h.phone,
    purok: h.purok,
    notes: h.notes,
    lat: h.lat,
    lng: h.lng,
  }));

  const prompt = `You are Mangluluwas, the Luwas DRRM chat agent for Brgy. Nangka, Consolacion, Cebu (Cebuano/English OK).
Be concise, calm, and actionable for barangay officers. Guidance for responders — not a life-safety guarantee.

Return ONLY valid JSON (no markdown) matching:
{
  "reply": string,
  "updateMap": boolean,
  "summary": string (required if updateMap),
  "focusHazard": "flood"|"landslide"|"typhoon"|"earthquake"|"weather"|"mixed" (if updateMap),
  "actions": [] (leave empty — server flags ALL flood/landslide/vulnerable households),
  "mapHint": string (if updateMap)
}

Set updateMap=true when the officer asks for triage, priorities, evacuate/prepare lists, escape routes, or map highlights.
Do not truncate the affected list — the server computes every evacuate/prepare household from hazards.
When updateMap=true, reply with counts and guidance; the full call list is attached server-side.
Safe points (server draws escape arrows): ${JSON.stringify(
    NANGKA_SAFE_POINTS.map((s) => ({ id: s.id, name: s.name })),
  )}

Weather: ${situation.weatherLabel ?? "unknown"}
Floods: ${JSON.stringify(situation.floods)}
Landslides: ${JSON.stringify(situation.landslides)}
Typhoons: ${JSON.stringify(situation.typhoons)}
Households: ${JSON.stringify(compactHouseholds)}

Recent chat:
${history.map((t) => `${t.role}: ${t.content}`).join("\n") || "(none)"}

Officer: ${message}`;

  try {
    const { text, model: usedModel } = await generateWithGeminiFallback(
      key,
      model,
      prompt,
    );

    const parsed = parseGeminiJson(text);
    if (!parsed?.reply) {
      const local = runLocalChat(message, situation);
      return NextResponse.json({
        ...local,
        reply: `${local.reply} (Gemini parse fallback)`,
      } satisfies ChatApiResponse);
    }

    if (!parsed.updateMap) {
      return NextResponse.json({
        reply: String(parsed.reply),
        source: "gemini",
        model: usedModel,
        assist: null,
      } satisfies ChatApiResponse);
    }

    // Full affected roster from local rules (Gemini cannot list thousands of ids).
    const local = runLocalAssist(situation);
    const assist = withEscapes(
      {
        summary: String(parsed.summary ?? local.summary),
        focusHazard: parsed.focusHazard ?? local.focusHazard,
        actions: local.actions,
        mapHint: String(
          parsed.mapHint ?? local.mapHint ?? "Map updated with priority homes.",
        ),
        source: "gemini",
        model: usedModel,
      },
      body,
    );

    const geminiReply = String(parsed.reply);
    const reply = formatAssistCallReply(
      geminiReply,
      assist.actions,
      situation.households,
      [assist.mapHint],
    );

    return NextResponse.json({
      reply,
      source: "gemini",
      model: usedModel,
      assist,
    } satisfies ChatApiResponse);
  } catch {
    const local = runLocalChat(message, situation);
    return NextResponse.json({
      ...local,
      reply: `${local.reply} (Gemini unavailable — local agent used.)`,
    } satisfies ChatApiResponse);
  }
}
