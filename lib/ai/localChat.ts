import type { AssistResult } from "@/lib/ai/assistTypes";
import { formatChatAssistReply } from "@/lib/ai/callList";
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
      `Here’s the plan: get the ${evacuateN || "low-ground"} households in the flood belt moving toward evacuation centers early, and have the ${prepareN || "higher-lot"} homes shelter in place. Tell families to start buying goods and drinking water now — rice, canned food, cooking fuel, medicine, flashlights — before shelves empty and roads get bad.`,
      "",
      "At the same time, stock the evacuation centers, schools used as shelters, and the barangay hall: drinking water, food packs, cooking fuel, blankets, hygiene kits, first aid, and power banks. Halls and schools are staging / command support — people sleep in the designated ECs.",
      "",
      "I’ve painted priorities on your map. Walk purok captains through the colors, then use the call list below when you’re ready to blast SMS/email.",
    ].join("\n");
  }

  if (/\b(flood|baha)\b/i.test(message) || assist.focusHazard === "flood") {
    return [
      "Flood risk is what we’re watching hardest in this Odette phase.",
      "",
      `I’ve marked ${evacuateN} homes that should evacuate from the flood belt and ${prepareN} on higher ground that should prepare and stay put. Escape arrows point to the nearest evacuation centers — not the hall or chapel.`,
      "",
      "Start stocking now: drinking water and goods for families, plus reserves at the evacuation centers, schools used as shelters, and the barangay hall (food, fuel, medicine, blankets, hygiene kits).",
      "",
      "Check the map colors with your team, then alert from the call list when you’re ready.",
    ].join("\n");
  }

  return [
    "Okay — I’ve run triage for Brgy. Nangka and updated the map.",
    "",
    `Priority right now: ${evacuateN} evacuate from low ground / flood belt, ${prepareN} prepare and shelter in place on higher lots. Escape lines go toward the designated evacuation centers.`,
    "",
    "While you still have time, start buying goods and water for households, and stock the evacuation centers, schools used as shelters, and the barangay hall.",
    "",
    "I’ll keep talking you through it — names and contacts are in the call list under the chat when you want to alert them.",
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
      reply: `There are ${situation.floods.length} flood zone(s) in the Odette simulation${
        critical.length ? `, including ${critical.length} critical` : ""
      }. Ask “what do we do?” or “run triage” and I’ll paint the map and explain red / yellow / blue.`,
      source: "local",
      assist: null,
    };
  }

  if (/\b(typhoon|bagyo|cyclone)\b/i.test(trimmed)) {
    const assist = runLocalAssist(situation);
    return withMapReply(humanTriageReply(trimmed, assist, situation), assist);
  }

  if (/\b(hello|hi|kumusta|who are you|what can you)\b/i.test(trimmed)) {
    return {
      reply:
        "Kumusta — I’m Mangluluwas, your LUWAS DRRM colleague for Brgy. Nangka in the Odette simulation. Ask what to do for a storm, or say “run triage” and I’ll paint the map. I can also text households, or call Consolacion BFP / PNP when you say “call the fire station” or “call the police”.",
      source: "local",
      assist: null,
    };
  }

  if (/\b(red|yellow|blue|color|colour|dot|square)\b/i.test(trimmed)) {
    return {
      reply: [
        "Sure — here’s how to read the map after triage:",
        "",
        "Red dots = households that should evacuate (low ground / flood belt).",
        "Yellow dots = prepare and shelter in place on higher lots — stock water, food, and cooking fuel.",
        "Blue squares = AI-predicted flood footprints from elevation and storm context.",
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
