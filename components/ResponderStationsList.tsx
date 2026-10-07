import {
  responderKindLabel,
  type ResponderKind,
  type ResponderStation,
} from "@/lib/geo/responderStations";

const KIND_ORDER: ResponderKind[] = ["pnp", "bfp", "tanod"];

type ResponderStationsListProps = {
  stations: ResponderStation[];
  /** Compact chips for LGU cards on the directory. */
  compact?: boolean;
};

export function ResponderStationsList({
  stations,
  compact = false,
}: ResponderStationsListProps) {
  if (stations.length === 0) return null;

  if (compact) {
    return (
      <ul className="mt-2 flex flex-wrap gap-1.5 px-4 pb-3">
        {stations.map((s) => (
          <li
            key={s.id}
            className="border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase"
            title={`${s.name} · ${s.covers}`}
          >
            {s.kind === "pnp" ? "PNP" : "BFP"} · {s.name.replace(/\s*\(BFP\)\s*$/, "")}
          </li>
        ))}
      </ul>
    );
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: stations.filter((s) => s.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
          Nearby responders
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Police (PNP) and fire (BFP) are usually city or municipal stations that
          cover many barangays. A barangay may have a tanod outpost — not always
          a full station.
        </p>
      </div>

      {groups.map(({ kind, items }) => (
        <div key={kind}>
          <h3 className="font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
            {responderKindLabel(kind)}
          </h3>
          <ul className="mt-2 space-y-2">
            {items.map((s) => (
              <li
                key={s.id}
                className="border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                  {s.name}
                </p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Seat · {s.seat}
                </p>
                <p className="mt-1 text-sm text-[var(--foreground)]">
                  Covers · {s.covers}
                </p>
                {s.notes ? (
                  <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                    {s.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
