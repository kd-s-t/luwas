import type { ReportDispatchLog } from "@/lib/reports/types";

export function mapDispatchLog(raw: unknown): ReportDispatchLog | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const called = Array.isArray(d.called)
    ? d.called.map((x) => String(x)).filter(Boolean)
    : [];
  const texted = Array.isArray(d.texted)
    ? d.texted.map((x) => String(x)).filter(Boolean)
    : [];
  const at = d.at != null ? String(d.at) : "";
  const summary =
    d.summary != null
      ? String(d.summary)
      : buildDispatchSummary({ called, texted });
  if (!at && called.length === 0 && texted.length === 0) return null;
  return { at: at || new Date().toISOString(), called, texted, summary };
}

export function buildDispatchSummary(input: {
  called: string[];
  texted: string[];
}): string {
  const parts: string[] = [];
  if (input.called.length > 0) {
    parts.push(`Called ${input.called.join(", ")}`);
  }
  if (input.texted.length > 0) {
    parts.push(`Texted ${input.texted.join(", ")}`);
  }
  return parts.join(" · ") || "Responders notified";
}

export function formatDispatchListLine(log: ReportDispatchLog): string {
  return log.summary || buildDispatchSummary(log);
}
