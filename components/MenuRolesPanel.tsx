/** Reference only — not enforced in the app yet. */
const MENU_ROLE_LEVELS = [
  {
    level: "Level 1",
    title: "Field",
    who: "Tanod, BHW, volunteer, general staff",
    summary:
      "Purok-facing work: see the map, handle field reports in scope, read house owners. No staff hire/fire, no barangay-wide blasts, no onboard.",
  },
  {
    level: "Level 2",
    title: "Ops / council",
    who: "Secretary, Treasurer, Kagawad, SK, MDRRMO, Tanod chief",
    summary:
      "Day-to-day command: Level 1 plus edit house owners, verify reports, use texts/alerts for the barangay, view Users. Still no hire/fire officers or onboard a new barangay.",
  },
  {
    level: "Level 3",
    title: "Punong Barangay",
    who: "Barangay captain",
    summary:
      "Can do all and see all — full command, staff, households, onboard, and every menu.",
  },
] as const;

const MENU_ROLE_MATRIX: {
  menu: string;
  l1: string;
  l2: string;
  l3: string;
}[] = [
  {
    menu: "Command center",
    l1: "View map & workspace",
    l2: "View + triage decisions",
    l3: "Full",
  },
  {
    menu: "Field reports",
    l1: "View / validate in purok",
    l2: "Verify & prioritize all",
    l3: "Full",
  },
  {
    menu: "House owners",
    l1: "Read only",
    l2: "Read + edit roster",
    l3: "Full",
  },
  {
    menu: "Users",
    l1: "View officers / citizens",
    l2: "View roster",
    l3: "Full · add / fire staff",
  },
  {
    menu: "Texts / alerts",
    l1: "Receive only",
    l2: "Draft & send barangay alerts",
    l3: "Full",
  },
  {
    menu: "Onboard",
    l1: "—",
    l2: "—",
    l3: "Full",
  },
  {
    menu: "Barangays / Profile",
    l1: "Own profile",
    l2: "Own profile",
    l3: "Full",
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
          Suggested access by level — info only, not applied in the app yet.
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
              <th className="px-3 py-2.5 font-medium">Level 1 · Field</th>
              <th className="px-3 py-2.5 font-medium">Level 2 · Ops</th>
              <th className="px-3 py-2.5 font-medium">Level 3 · Captain</th>
            </tr>
          </thead>
          <tbody>
            {MENU_ROLE_MATRIX.map((row) => (
              <tr
                key={row.menu}
                className="border-t border-[var(--border)]/70"
              >
                <td className="px-3 py-2.5 font-medium">{row.menu}</td>
                <td className="px-3 py-2.5 text-[var(--muted)]">{row.l1}</td>
                <td className="px-3 py-2.5 text-[var(--muted)]">{row.l2}</td>
                <td className="px-3 py-2.5 text-[var(--accent)]">{row.l3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
