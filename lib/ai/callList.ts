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

/** Plain-language map legend for officers (matches pin / flood colors). */
export const MAP_COLOR_LEGEND =
  "On the map: red dots = evacuate (low ground / flood belt), yellow dots = prepare and shelter in place on higher lots (stock water, food, cooking fuel), blue squares = AI-predicted flood footprints.";

/**
 * Conversational chat reply after triage — explains colors + counts.
 * Full household roster stays in the call-list panel, not the bubble.
 */
export function formatChatAssistReply(
  reply: string,
  actions: AssistHouseholdAction[],
  extras: string[] = [],
): string {
  const evacuateN = actions.filter((a) => a.priority === "evacuate").length;
  const prepareN = actions.filter((a) => a.priority === "prepare").length;
  const sections: string[] = [reply.trim()];

  if (!/\bred\b[\s\S]*\byellow\b[\s\S]*\bblue\b/i.test(reply)) {
    sections.push("", MAP_COLOR_LEGEND);
  }

  if (evacuateN || prepareN) {
    sections.push(
      "",
      `I’ve flagged ${evacuateN} evacuate and ${prepareN} prepare homes — names and contacts are in the call list below when you’re ready to alert them by SMS or email.`,
    );
  }

  for (const e of extras) {
    if (e.trim() && !sections.includes(e.trim())) sections.push("", e.trim());
  }

  return sections.join("\n");
}
