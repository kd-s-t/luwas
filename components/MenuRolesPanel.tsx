/** App roles — matches `UserRole` in lib/auth/types. */
const MENU_ROLE_LEVELS = [
  {
    level: "Citizen",
    title: "Resident",
    who: "Household residents, guests filing reports",
    summary:
      "Public and citizen surfaces: report incidents, track own reports, find assistance, view evac centers and barangay pages. No command center.",
  },
  {
    level: "Officer",
    title: "Command",
    who: "Captain, MDRRMO, tanod, LGU / barangay staff",
    summary:
      "Barangay command center: overview, incidents, resources, households, citizens, officers, inventory, partners, evac centers, and own support tickets.",
  },
  {
    level: "Developer",
    title: "Platform",
    who: "UGNAI developers (Nexora Labs)",
    summary:
      "Developer console: users across barangays, onboard, Earth Engine, support triage, flows, cost, and role reference. Not day-to-day field command.",
  },
] as const;

const MENU_ROLE_MATRIX: {
  menu: string;
  citizen: string;
  officer: string;
  developer: string;
}[] = [
  {
    menu: "Public home / map",
    citizen: "Full",
    officer: "Full",
    developer: "Full",
  },
  {
    menu: "Report incident",
    citizen: "File & track own",
    officer: "Via incidents board",
    developer: "Via /dev/incidents",
  },
  {
    menu: "My reports",
    citizen: "Full",
    officer: "—",
    developer: "—",
  },
  {
    menu: "Command center",
    citizen: "—",
    officer: "Full (/admin)",
    developer: "—",
  },
  {
    menu: "Incidents",
    citizen: "Own reports only",
    officer: "Triage & assign",
    developer: "Read / triage (/dev)",
  },
  {
    menu: "Resources / inventory",
    citizen: "—",
    officer: "Full",
    developer: "—",
  },
  {
    menu: "Home owners / citizens",
    citizen: "—",
    officer: "Validate & edit",
    developer: "Users list (/dev)",
  },
  {
    menu: "Officers roster",
    citizen: "—",
    officer: "Full",
    developer: "Via Users",
  },
  {
    menu: "Support tickets",
    citizen: "File own (/support)",
    officer: "File own (/admin/support)",
    developer: "Triage all (/dev/support)",
  },
  {
    menu: "Onboard barangay",
    citizen: "—",
    officer: "Limited (/admin/onboard)",
    developer: "Full (/dev/onboard)",
  },
  {
    menu: "Earth Engine",
    citizen: "—",
    officer: "—",
    developer: "Full",
  },
  {
    menu: "Flows / cost / refs",
    citizen: "—",
    officer: "—",
    developer: "Full",
  },
];

export function MenuRolesPanel() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Reference
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Roles
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Citizen, officer, and developer — the three account roles in the app.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MENU_ROLE_LEVELS.map((row) => (
          <div
            key={row.level}
            className="border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3"
          >
            <p className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
              {row.level} · {row.title}
            </p>
            <p className="mt-1 text-sm font-medium">{row.who}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
              {row.summary}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border border-[var(--border)] bg-[var(--surface-raised)]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            <tr>
              <th className="px-3 py-2.5 font-medium">Menu</th>
              <th className="px-3 py-2.5 font-medium">Citizen</th>
              <th className="px-3 py-2.5 font-medium">Officer</th>
              <th className="px-3 py-2.5 font-medium">Developer</th>
            </tr>
          </thead>
          <tbody>
            {MENU_ROLE_MATRIX.map((row) => (
              <tr
                key={row.menu}
                className="border-t border-[var(--border)]/70"
              >
                <td className="px-3 py-2.5 font-medium">{row.menu}</td>
                <td className="px-3 py-2.5 text-[var(--muted)]">
                  {row.citizen}
                </td>
                <td className="px-3 py-2.5 text-[var(--muted)]">
                  {row.officer}
                </td>
                <td className="px-3 py-2.5 text-[var(--accent)]">
                  {row.developer}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
