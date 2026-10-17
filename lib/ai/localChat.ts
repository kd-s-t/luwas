import type { AssistResult } from "@/lib/ai/assistTypes";
import {
  formatChatAssistReply,
  MAP_LEGEND_MARKER,
} from "@/lib/ai/callList";
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
  /** Tino scenario phase — AI triage paints in before + during. */
  phase?: "nostorm" | "before" | "during" | "after";
};

const TRIAGE_AFTER_ONLY =
  "Map triage (flood footprints, evacuate/prepare, escape lines) runs in Before and During. Switch the scenario bar to Before or During, then ask me again.";

function triageAllowed(situation: Situation): boolean {
  return !situation.phase || situation.phase === "before" || situation.phase === "during";
}

function wantsTriage(message: string): boolean {
  return /\b(triage|evacuat|priorit|highlight|assist|who should|run (the )?map|update (the )?map|escape|safe point|go-bag|prepare)\b/i.test(
    message,
  );
}

/** Situational “what do we do?” — still paint the map, but answer like a person. */
function wantsAdvice(message: string): boolean {
  return /\b(what (do|should) we do|ano ang|unsaon|coming|incoming|cat\s*[1-5]|prepare for|ano buhaton|unsa'y|unsay)\b/i.test(
    message,
  );
}

function wantsClear(message: string): boolean {
  return /\b(clear|reset|remove)\b.*\b(highlight|map|pin|assist)\b/i.test(
    message,
  );
}

function humanTriageReply(
  message: string,
  assist: AssistResult,
  situation: Situation,
): string {
  const ty = [...situation.typhoons].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0];
  const evacuateN = assist.actions.filter((a) => a.priority === "evacuate")
    .length;
  const prepareN = assist.actions.filter((a) => a.priority === "prepare")
    .length;
  const stormBit = /\b(typhoon|bagyo|cyclone|cat\s*[1-5])\b/i.test(message);

  if (stormBit || assist.focusHazard === "typhoon") {
    const lead = ty
      ? `${ty.name} is roughly ${Math.round(ty.distanceKm)} km out${
          ty.maxWindsKmh ? ` (${ty.maxWindsKmh} km/h winds)` : ""
        }.`
      : "A major typhoon on that timeline is serious for Nangka.";
    return [
      `Three days is a real window — let’s use it, not panic. ${lead}`,
      "",
      `Get the ${evacuateN || "low-ground"} flood-belt households moving to evacuation centers early. Higher-lot homes (${prepareN || "many"}) shelter in place — tell families to buy rice, canned food, cooking fuel, medicine, and flashlights before shelves empty.`,
      "",
      "I’ve painted priorities on your map. Walk purok captains through the legend, then use the call list when you’re ready to blast SMS/email.",
    ].join("\n");
  }

  if (/\b(flood|baha)\b/i.test(message) || assist.focusHazard === "flood") {
    return [
      "Flood risk is what we’re watching hardest in this Tino phase.",
      "",
      `I’ve marked ${evacuateN} homes that should evacuate from the flood belt and ${prepareN} on higher ground that should prepare and stay put. Escape lines point to the nearest evacuation centers — not the hall or chapel.`,
      "",
      "Check the map legend with your team, then alert from the call list when you’re ready.",
    ].join("\n");
  }

  return [
    "We’re locking in disaster response for Brgy. Nangka — map is updated.",
    "",
    `Priority right now: ${evacuateN} evacuate from low ground / flood belt, ${prepareN} prepare and shelter in place on higher lots.`,
    "",
    "Names and contacts are in the call list under the chat when you want to alert them.",
  ].join("\n");
}

function withMapReply(
  reply: string,
  assist: AssistResult,
): ChatApiResponse {
  return {
    reply: formatChatAssistReply(reply, assist.actions, [assist.mapHint ?? ""]),
    source: "local",
    assist,
  };
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
        "Map highlights cleared. Ask me to run triage again when you need priority homes and escape lines — I’ll explain the colors again when we paint them.",
      source: "local",
      assist: null,
    };
  }

  if (!trimmed || wantsTriage(trimmed) || wantsAdvice(trimmed)) {
    if (!triageAllowed(situation)) {
      return {
        reply: TRIAGE_AFTER_ONLY,
        source: "local",
        assist: null,
      };
    }
    const assist = runLocalAssist(situation);
    const reply = !trimmed
      ? humanTriageReply("run triage", assist, situation)
      : humanTriageReply(trimmed, assist, situation);
    return withMapReply(reply, assist);
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
        ? `Right now for Brgy. Nangka: ${situation.weatherLabel}. If you want, say “run triage” and I’ll paint who should evacuate vs prepare — and I’ll walk you through the red, yellow, and blue on the map.`
        : "Weather feed isn’t loaded yet. Try again shortly, or ask me to run triage on the sample hazards and I’ll explain the map colors.",
      source: "local",
      assist: null,
    };
  }

  if (/\b(flood|baha)\b/i.test(trimmed)) {
    const critical = situation.floods.filter((f) => f.severity === "critical");
    return {
      reply: `There are ${situation.floods.length} flood zone(s) in the Tino simulation${
        critical.length ? `, including ${critical.length} critical` : ""
      }. Ask “what do we do?” or “run triage” and I’ll paint the map and explain red / yellow / blue.`,
      source: "local",
      assist: null,
    };
  }

  if (/\b(typhoon|bagyo|cyclone)\b/i.test(trimmed)) {
    if (!triageAllowed(situation)) {
      return {
        reply: TRIAGE_AFTER_ONLY,
        source: "local",
        assist: null,
      };
    }
    const assist = runLocalAssist(situation);
    return withMapReply(humanTriageReply(trimmed, assist, situation), assist);
  }

  if (/\b(hello|hi|kumusta|who are you|what can you)\b/i.test(trimmed)) {
    return {
      reply:
        "Kumusta — I’m Agent Nangka, your UGNAI DRRM colleague for Brgy. Nangka in the Tino simulation. Ask what to do for a storm, or say “run triage” and I’ll paint the map. I can also text households, or call Consolacion BFP / PNP when you say “call the fire station” or “call the police”.",
      source: "local",
      assist: null,
    };
  }

  if (/\b(red|yellow|blue|green|color|colour|dot|square|legend)\b/i.test(trimmed)) {
    return {
      reply: [
        "Sure — here’s the map legend:",
        "",
        MAP_LEGEND_MARKER,
        "",
        "Say “run triage” if those layers aren’t on the map yet.",
      ].join("\n"),
      source: "local",
      assist: null,
    };
  }

  return {
    reply: `I can walk you through Nangka DRRM guidance (${mapped} mapped households, ${situation.floods.length} floods, ${situation.landslides.length} landslide samples${
      ty ? `, typhoon ${ty.name}` : ""
    }). Ask “what do we do?” for a storm, “run triage”, “call the fire station”, “call the police”, or “what do the colors mean?”`,
    source: "local",
    assist: null,
  };
}
