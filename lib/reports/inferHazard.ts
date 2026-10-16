import type { ReportHazardHint } from "@/lib/reports/types";

const HINTS: ReportHazardHint[] = [
  "flood",
  "landslide",
  "typhoon",
  "fire",
  "crime",
  "accident",
  "blockage",
  "evac",
  "other",
];

/** Normalize model / Vertex class strings to a report hazard hint. */
export function parseHazardHint(raw: unknown): ReportHazardHint | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return null;
  if ((HINTS as string[]).includes(s)) return s as ReportHazardHint;
  if (/fire|sunog|blaze|flame|smoke|burning/.test(s)) return "fire";
  if (/flood|baha|tubig/.test(s)) return "flood";
  if (/landslide|gusaw|slope/.test(s)) return "landslide";
  if (/typhoon|bagyo|storm|wind/.test(s)) return "typhoon";
  if (/crime|robbery|theft|assault|shoot/.test(s)) return "crime";
  if (/accident|crash|collision|vehicular/.test(s)) return "accident";
  if (/block|debris|road/.test(s)) return "blockage";
  if (/evac|shelter/.test(s)) return "evac";
  return null;
}

/** Infer hazard from situation / notes / voice / AI reason text. */
export function inferHazard(
  ...parts: Array<string | null | undefined>
): ReportHazardHint {
  const t = parts
    .map((s) => s?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!t) return "other";
  if (/flood|tubig|baha|knee-deep|knee deep/.test(t)) return "flood";
  if (/landslide|land slide|gusaw|dahon/.test(t)) return "landslide";
  if (
    /road.?block|blockage|blocked road|fallen tree|nahulog.*kahoy|debris|washout|impassable|no.?pass|hindi.?makadaan|road closed|access road/.test(
      t,
    )
  )
    return "blockage";
  if (/typhoon|bagyo|hangin|wind|storm/.test(t)) return "typhoon";
  if (
    /\bfire\b|\bsunog\b|\busok\b|\bsmoke\b|\bblaz(e|ing)\b|\bflames?\b|\bburning\b|\bnasusunog\b/.test(
      t,
    )
  )
    return "fire";
  if (
    /crime|hold.?up|holdup|robbery|theft|nakaw|assault|stab|shoot|gunshot|snatch|riot/.test(
      t,
    )
  )
    return "crime";
  if (
    /accident|banggaan|crash|collision|vehicular|hit.?and.?run|road.?crash|car.?accident|motorcycle.?accident/.test(
      t,
    )
  )
    return "accident";
  if (/evac|shelter|evacuation/.test(t)) return "evac";
  return "other";
}
