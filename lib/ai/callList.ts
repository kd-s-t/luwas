import type { AssistHouseholdAction } from "@/lib/ai/assistTypes";
import type { Household } from "@/lib/households/types";

export type AssistActionWithContact = AssistHouseholdAction & {
  ownerName?: string;
  phone?: string;
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
      purok: h.purok,
    };
  });
}

function formatActionLine(a: AssistActionWithContact): string {
  const label = a.priority.toUpperCase();
  const name = a.ownerName?.trim() || "Unknown owner";
  const phone = a.phone?.trim() || "no phone on file";
  const purok = a.purok?.trim() || "—";
  return `• ${label} · ${name} · ${phone} · ${purok} — ${a.reason}`;
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
      `… and ${rows.length - preview.length} more on the map list / Text evacuate.`,
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
