import {
  phoneToTelHref,
  responderKindLabel,
  type ResponderKind,
  type ResponderStation,
} from "@/lib/geo/responderStations";

const KIND_ORDER: ResponderKind[] = ["hotline", "pnp", "bfp", "tanod"];

type ResponderStationsListProps = {
  stations: ResponderStation[];
  /** Compact chips for LGU cards on the directory. */
  compact?: boolean;
};

function ContactLinks({ station }: { station: ResponderStation }) {
  const phones = station.phones ?? [];
  const mobiles = station.mobiles ?? [];
  if (!phones.length && !mobiles.length && !station.email && !station.address) {
    return (
      <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
        Contact not yet verified · dial 911 in emergencies
      </p>
    );
  }

  return (
    <dl className="mt-2 space-y-1.5 text-sm">
      {phones.length > 0 ? (
        <div>
          <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Telephone
          </dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {phones.map((p) => (
              <a
                key={p}
                href={phoneToTelHref(p)}
                className="font-mono text-[var(--accent)] underline-offset-2 hover:underline"
              >
                {p}
              </a>
            ))}
          </dd>
        </div>
      ) : null}
      {mobiles.length > 0 ? (
        <div>
          <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Mobile
          </dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {mobiles.map((p) => (
              <a
                key={p}
                href={phoneToTelHref(p)}
                className="font-mono text-[var(--accent)] underline-offset-2 hover:underline"
              >
                {p}
              </a>
            ))}
          </dd>
        </div>
      ) : null}
      {station.email ? (
        <div>
          <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Email
          </dt>
          <dd>
            <a
              href={`mailto:${station.email}`}
              className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {station.email}
            </a>
          </dd>
        </div>
      ) : null}
      {station.address ? (
        <div>
          <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Address
          </dt>
          <dd className="text-[var(--muted)]">{station.address}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function ResponderStationsList({
  stations,
  compact = false,
}: ResponderStationsListProps) {
  if (stations.length === 0) return null;

  if (compact) {
    return (
      <ul className="mt-2 flex flex-wrap gap-1.5 px-4 pb-3">
        {stations
          .filter((s) => s.kind !== "hotline")
          .map((s) => (
            <li
              key={s.id}
              className="border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase"
              title={[
                s.name,
                s.covers,
                ...(s.phones ?? []),
                ...(s.mobiles ?? []),
              ].join(" · ")}
            >
              {s.kind === "pnp" ? "PNP" : s.kind === "bfp" ? "BFP" : "Tanod"} ·{" "}
              {s.name.replace(/\s*\(BFP\)\s*$/, "")}
              {s.phones?.[0] ? ` · ${s.phones[0]}` : ""}
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
          cover many barangays. Numbers are from public LGU / hotline directories
          — verify before operational use. In life-threatening emergencies dial{" "}
          <a
            href="tel:911"
            className="font-mono text-[var(--accent)] underline-offset-2 hover:underline"
          >
            911
          </a>
          .
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
                <ContactLinks station={s} />
                {s.notes ? (
                  <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                    {s.notes}
                  </p>
                ) : null}
                {s.source ? (
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Source · {s.source}
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
