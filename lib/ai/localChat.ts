import type { AssistResult } from "@/lib/ai/assistTypes";
import type { ChatApiResponse } from "@/lib/ai/chatTypes";
import { runLocalAssist } from "@/lib/ai/localAssist";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

type Situation = {
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
};

function wantsTriage(message: string): boolean {
  return /\b(triage|evacuat|priorit|highlight|assist|who should|run (the )?map|update (the )?map|escape|safe point|go-bag|prepare)\b/i.test(
    message,
  );
}

function wantsClear(message: string): boolean {
  return /\b(clear|reset|remove)\b.*\b(highlight|map|pin|assist)\b/i.test(
    message,
  );
}

function formatAssistReply(assist: AssistResult): string {
  const evacuate = assist.actions.filter((a) => a.priority === "evacuate");
  const prepare = assist.actions.filter((a) => a.priority === "prepare");
  const lines = [
    assist.summary,
    evacuate.length
      ? `Evacuate focus: ${evacuate.length} household(s).`
      : null,
    prepare.length ? `Prepare: ${prepare.length} household(s).` : null,
    assist.escapes.length
      ? `${assist.escapes.length} escape route(s) suggested toward safe points.`
      : null,
    assist.mapHint,
  ].filter(Boolean);
  return lines.join(" ");
}

/** Deterministic chat when Gemini is unavailable. */
export function runLocalChat(
  message: string,
  situation: Situation,
): ChatApiResponse {
  const trimmed = message.trim();

  if (wantsClear(trimmed)) {
    return {
      reply:
        "Map highlights cleared. Ask me to run triage again when you need priority homes and escape lines.",
      source: "local",
      assist: null,
    };
  }

  if (!trimmed || wantsTriage(trimmed)) {
    const assist = runLocalAssist(situation);
    return {
      reply: formatAssistReply(assist),
      source: "local",
      assist,
    };
  }

  const mapped = situation.households.filter(
    (h) => h.lat != null && h.lng != null,
  ).length;
  const ty = [...situation.typhoons].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0];

  if (/\b(weather|ulan|rain|hangin|wind)\b/i.test(trimmed)) {
    return {
      reply: situation.weatherLabel
        ? `Current conditions for Brgy. Nangka: ${situation.weatherLabel}. I can also run triage to flag homes for evacuate / prepare.`
        : "Weather feed is not loaded yet. Try again shortly, or ask me to run triage on the sample hazards.",
      source: "local",
      assist: null,
    };
  }

  if (/\b(flood|baha)\b/i.test(trimmed)) {
    const critical = situation.floods.filter((f) => f.severity === "critical");
    return {
      reply: `There are ${situation.floods.length} demo flood sample(s) on the map${
        critical.length ? `, including ${critical.length} critical` : ""
      }. Say “run triage” and I’ll highlight priority households and escape directions.`,
      source: "local",
      assist: null,
    };
  }

  if (/\b(typhoon|bagyo|cyclone)\b/i.test(trimmed)) {
    return {
      reply: ty
        ? `${ty.name} is about ${Math.round(ty.distanceKm)} km out (${ty.maxWindsKmh} km/h). Ask for triage to mark monitor / prepare homes.`
        : "No typhoon track samples in the current demo set.",
      source: "local",
      assist: null,
    };
  }

  if (/\b(hello|hi|kumusta|who are you|what can you)\b/i.test(trimmed)) {
    return {
      reply:
        "I’m Mangluluwas — Luwas’ DRRM chat agent for Brgy. Nangka. Ask about weather, floods, or typhoons, or say “run triage” to prioritize households and draw escape routes on the map.",
      source: "local",
      assist: null,
    };
  }

  return {
    reply: `I can help with Nangka DRRM guidance (${mapped} mapped households, ${situation.floods.length} floods, ${situation.landslides.length} landslide samples${
      ty ? `, typhoon ${ty.name}` : ""
    }). Try “run triage”, “who should evacuate?”, or ask about weather / floods.`,
    source: "local",
    assist: null,
  };
}
