import type { AssistHouseholdAction } from "@/lib/ai/assistTypes";
import type { Household } from "@/lib/households/types";

export type AssistActionWithContact = AssistHouseholdAction & {
  ownerName?: string;
  phone?: string;
  email?: string;
  purok?: string;
};

/** Attach roster contact fields so officers can call from chat / map strip. */
export function enrichActionsWithContacts(
  actions: AssistHouseholdAction[],
  households: Household[],
): AssistActionWithContact[] {
  const byId = new Map(households.map((h) => [h.id, h]));
  return actions.map((a) => {
    const h = byId.get(a.householdId);
    if (!h) return a;
    return {
      ...a,
      ownerName: h.ownerName,
      phone: h.phone,
      email: h.email,
      purok: h.purok,
    };
  });
}

function formatActionLine(a: AssistActionWithContact): string {
  const label = a.priority.toUpperCase();
  const name = a.ownerName?.trim() || "Unknown owner";
  const phone = a.phone?.trim();
  const email = a.email?.trim();
  const contact =
    [phone, email].filter(Boolean).join(" · ") || "no phone/email on file";
  const purok = a.purok?.trim() || "—";
  return `• ${label} · ${name} · ${contact} · ${purok} — ${a.reason}`;
}

const CHAT_LIST_PREVIEW = 24;

function appendPrioritySection(
  sections: string[],
  label: string,
  rows: AssistActionWithContact[],
) {
  if (!rows.length) return;
  sections.push("", `Call · ${label} (${rows.length}):`);
  const preview = rows.slice(0, CHAT_LIST_PREVIEW);
  sections.push(...preview.map(formatActionLine));
  if (rows.length > preview.length) {
    sections.push(
      `… and ${rows.length - preview.length} more on the map list / alert evacuate.`,
    );
  }
}

/** Chat reply block listing priority households with numbers to call. */
export function formatAssistCallReply(
  summary: string,
  actions: AssistHouseholdAction[],
  households: Household[],
  extras: string[] = [],
): string {
  const enriched = enrichActionsWithContacts(actions, households);
  const evacuate = enriched.filter((a) => a.priority === "evacuate");
  const prepare = enriched.filter((a) => a.priority === "prepare");
  const monitor = enriched.filter((a) => a.priority === "monitor");

  const sections: string[] = [summary.trim()];

  appendPrioritySection(sections, "evacuate", evacuate);
  appendPrioritySection(sections, "prepare", prepare);
  if (monitor.length && !evacuate.length && !prepare.length) {
    appendPrioritySection(sections, "monitor", monitor);
  }

  for (const e of extras) {
    if (e.trim()) sections.push("", e.trim());
  }

  return sections.join("\n");
}

/** Injected into chat replies — MangluluwasChat renders a color legend. */
export const MAP_LEGEND_MARKER = "[[LUWAS_MAP_LEGEND]]";

/** Injected into chat replies — MangluluwasChat renders a stock checklist. */
export const STOCK_LIST_MARKER = "[[LUWAS_STOCK_LIST]]";

export const MAP_LEGEND_ITEMS = [
  {
    color: "#1f8f55",
    label: "Green dots",
    detail: "House owners — mapped households · not on evacuate/prepare yet",
  },
  {
    color: "#c72929",
    label: "Red dots",
    detail: "Evacuate — low ground / flood belt",
  },
  {
    color: "#b8860b",
    label: "Yellow dots",
    detail: "Shelter in place — higher lots · stock essentials",
  },
  {
    color: "#2563eb",
    label: "Blue tiles",
    detail: "Flood footprints — where water collects first",
  },
] as const;

export const STOCK_LIST_ITEMS = [
  "Food packs",
  "Drinking water",
  "Cooking fuel",
  "Medicine / first aid",
  "Blankets",
  "Hygiene kits",
  "Flashlights",
  "Power banks",
] as const;

/** Drop model prose that already explained colors / “running AI”. */
export function stripTriageProseNoise(reply: string): string {
  let out = reply;

  // Markers stay for the UI splitter; strip them here when we only want text.
  out = out.replaceAll(MAP_LEGEND_MARKER, "");
  out = out.replaceAll(STOCK_LIST_MARKER, "");

  out = out.replace(
    /\bWe are running the AI triage[^.!?]*[.!?]/gi,
    "We’re locking in disaster response for Barangay Nangka.",
  );
  out = out.replace(
    /\b(?:I(?:['’]m| am) )?(?:re-?)?running (?:the )?AI triage[^.!?]*[.!?]/gi,
    "We’re locking in disaster response for Barangay Nangka.",
  );

  // Single-paragraph Gemini slurries: cut map-color + stock sentences hard.
  out = out.replace(
    /\s*On your map,[\s\S]*?(?=(?:Please ensure|You can alert|I(?:['’]ve| have) flagged|$))/i,
    " ",
  );
  out = out.replace(
    /\s*Blue squares outline[\s\S]*?(?=(?:Please ensure|You can alert|I(?:['’]ve| have) flagged|$))/i,
    " ",
  );
  out = out.replace(
    /\s*Please ensure our evacuation centers[\s\S]*?(?=(?:You can alert|I(?:['’]ve| have) flagged|$))/i,
    " ",
  );
  out = out.replace(
    /\s*(?:Red|Yellow)\s+household\s+dots[\s\S]*?(?=(?:Blue |Please |You can |I(?:['’]ve| have) |$))/gi,
    " ",
  );

  out = out.replace(/\bAI[- ]?(?:predicted|assisted|powered)\s+/gi, "");
  out = out.replace(/\bAI triage\b/gi, "triage");
  out = out.replace(/\bAI-predicted\b/gi, "predicted");

  out = out.replace(
    /On the map:\s*red dots[\s\S]*?flood footprints\.?/gi,
    "",
  );
  out = out.replace(
    /stock the evacuation centers[\s\S]*?(?=(\n\n|$))/i,
    "",
  );

  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

/**
 * Conversational chat reply after triage — legend + stock render in the UI.
 * Full household roster stays in the call-list panel, not the bubble.
 */
export function formatChatAssistReply(
  reply: string,
  actions: AssistHouseholdAction[],
  extras: string[] = [],
): string {
  const evacuateN = actions.filter((a) => a.priority === "evacuate").length;
  const prepareN = actions.filter((a) => a.priority === "prepare").length;
  const cleaned = stripTriageProseNoise(reply);
  const sections: string[] = cleaned ? [cleaned] : [];

  sections.push("", MAP_LEGEND_MARKER, "", STOCK_LIST_MARKER);

  if (evacuateN || prepareN) {
    sections.push(
      "",
      `I’ve flagged ${evacuateN} evacuate and ${prepareN} prepare homes — names and contacts are in the call list below when you’re ready to alert them by SMS or email.`,
    );
  }

  for (const e of extras) {
    const t = stripTriageProseNoise(e.trim());
    if (
      t &&
      !/flood footprints/i.test(t) &&
      !/AI /i.test(t) &&
      !sections.includes(t)
    ) {
      sections.push("", t);
    }
  }

  return sections.join("\n").trim();
}
