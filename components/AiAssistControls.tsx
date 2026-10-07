"use client";

import type { AssistResult } from "@/lib/ai/assistTypes";

type AiAssistControlsProps = {
  running: boolean;
  result: AssistResult | null;
  error: string | null;
  onRun: () => void;
  onClear: () => void;
};

export function AiAssistControls({
  running,
  result,
  error,
  onRun,
  onClear,
}: AiAssistControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
        >
          <span aria-hidden className="font-mono text-xs">
            ✦
          </span>
          {running ? "AI assisting…" : "AI Assist"}
        </button>
        {result ? (
          <button
            type="button"
            onClick={onClear}
            className="border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Clear highlights
          </button>
        ) : null}
        {result ? (
          <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            via {result.source === "gemini" ? "Gemini" : "local rules"}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="border border-[var(--accent)]/40 bg-[var(--surface-panel)] px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Assist · {result.focusHazard}
          </p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{result.summary}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{result.mapHint}</p>
          {result.actions.length ? (
            <ul className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3">
              {result.actions.slice(0, 6).map((a) => {
                const escape = result.escapes?.find(
                  (e) => e.householdId === a.householdId,
                );
                return (
                  <li key={`${a.householdId}-${a.priority}`} className="text-sm">
                    <span
                      className={`font-mono text-[10px] uppercase ${
                        a.priority === "evacuate"
                          ? "text-[var(--danger)]"
                          : a.priority === "prepare"
                            ? "text-[var(--warn)]"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {a.priority}
                    </span>{" "}
                    <span className="text-[var(--muted)]">{a.reason}</span>
                    {escape ? (
                      <p className="mt-0.5 text-xs text-[var(--accent)]">
                        {escape.routed ? "Via roads" : "Escape"}{" "}
                        {escape.direction} → {escape.destinationName} (
                        {Math.max(50, Math.round(escape.distanceKm * 1000))} m)
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
