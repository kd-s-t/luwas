"use client";

import type { ScenarioBundle } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

type ScenarioNeedsPanelProps = {
  bundle: ScenarioBundle;
  className?: string;
};

function priorityLabel(
  phase: ScenarioBundle["phase"],
  priority: string,
): string {
  if (phase === "after" && priority === "monitor") return "Needs check";
  if (priority === "evacuate") return "Evacuate";
  if (priority === "prepare") return "Prepare";
  return "Monitor";
}

export function ScenarioNeedsPanel({
  bundle,
  className,
}: ScenarioNeedsPanelProps) {
  const evac = bundle.needs.filter((n) => n.priority === "evacuate");
  const help = bundle.needs.filter(
    (n) => n.priority === "prepare" || (n.blocked && n.priority !== "evacuate"),
  );
  const checks = bundle.needs.filter(
    (n) => n.needsCheck || (bundle.phase === "after" && n.priority === "monitor"),
  );
  const blocked = bundle.needs.filter((n) => n.blocked);
  const liveReports = bundle.reportPins.filter(
    (r) => r.kind === "blockage" || r.kind === "fire" || r.kind === "flood",
  );

  return (
    <aside
      className={cn(
        "border border-[var(--border)] bg-[var(--surface-raised)]",
        className,
      )}
    >
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          {bundle.label}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{bundle.blurb}</p>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        <NeedColumn
          title={
            bundle.phase === "before"
              ? "Must evacuate"
              : bundle.phase === "after"
                ? "Still displaced"
                : "Needs help · evacuate"
          }
          empty="No priority evacuations"
          items={evac.map((n) => ({
            id: n.householdId,
            title: n.ownerName,
            meta: `${n.purok}${n.blocked ? " · blocked" : ""}`,
            detail: n.reason,
            tone: "danger" as const,
          }))}
        />

        {bundle.phase === "before" ? (
          <NeedColumn
            title="Prepare now"
            empty="No prepare list"
            items={bundle.needs
              .filter((n) => n.priority === "prepare")
              .map((n) => ({
                id: n.householdId,
                title: n.ownerName,
                meta: n.purok,
                detail: n.reason,
                tone: "warn" as const,
              }))}
          />
        ) : (
          <NeedColumn
            title={
              bundle.phase === "after"
                ? "Blocked / fire risk"
                : "Blocked by reports"
            }
            empty="No blockages flagged"
            items={(blocked.length ? blocked : help).map((n) => ({
              id: n.householdId,
              title: n.ownerName,
              meta: `${n.purok}${n.blocked ? " · road blocked" : ""}`,
              detail: n.reason,
              tone: "warn" as const,
            }))}
          />
        )}

        {bundle.phase === "after" ? (
          <NeedColumn
            title="Welfare check · roster"
            empty="All checked in"
            items={checks.map((n) => ({
              id: n.householdId,
              title: n.ownerName,
              meta: n.purok,
              detail: n.reason,
              tone: "check" as const,
            }))}
          />
        ) : bundle.phase === "during" ? (
          <NeedColumn
            title="Live image reports"
            empty="No live reports"
            items={liveReports.map((r) => ({
              id: r.id,
              title: r.title,
              meta: `${r.purokHint} · ${r.sourceLabel}`,
              detail: r.notes,
              tone: "report" as const,
            }))}
          />
        ) : (
          <NeedColumn
            title="Forecast path"
            empty="No track"
            items={(bundle.typhoons[0]?.track ?? []).slice(0, 5).map((p, i) => ({
              id: `track-${i}`,
              title: p.label ?? `Point ${i + 1}`,
              meta: `${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°`,
              detail: p.at
                ? new Date(p.at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Track point",
              tone: "info" as const,
            }))}
          />
        )}
      </div>

      {bundle.phase === "after" && liveReports.length > 0 ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            Live blockage / fire reports
          </p>
          <ul className="mt-2 space-y-2">
            {liveReports.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium text-[var(--foreground)]">
                  {r.title}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {r.purokHint} · {r.sourceLabel} · {r.notes}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-2 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
        {bundle.needs.slice(0, 3).map((n) => (
          <span key={`leg-${n.householdId}`}>
            {priorityLabel(bundle.phase, n.priority)}
          </span>
        ))}
        <span>Escapes {bundle.escapes.length}</span>
        <span>Reports {bundle.reportPins.length}</span>
        <span>Fires {bundle.fires.length}</span>
      </div>
    </aside>
  );
}

type NeedItem = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  tone: "danger" | "warn" | "check" | "report" | "info";
};

function NeedColumn({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: NeedItem[];
}) {
  return (
    <div className="border-t border-[var(--border)] px-4 py-3 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-2.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    item.tone === "danger" && "bg-[var(--danger)]",
                    item.tone === "warn" && "bg-[var(--warn)]",
                    item.tone === "check" && "bg-[#7c3aed]",
                    item.tone === "report" && "bg-[#b45309]",
                    item.tone === "info" && "bg-[#2563eb]",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">
                    {item.title}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted)] uppercase">
                    {item.meta}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
