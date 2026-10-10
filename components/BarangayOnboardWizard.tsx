"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center border border-[var(--border)] bg-[var(--surface-panel)]/40 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:h-[340px]">
      Loading map…
    </div>
  ),
});
import {
  filterMapAreaOptions,
  listMapAreaOptions,
  resolveKnownMapArea,
  type MapAreaOption,
} from "@/lib/geo/mapAreas";
import { seedDemoBarangayOps } from "@/lib/onboarding/demoSeed";
import {
  emptyDraft,
  setPreferredAreaId,
  type OnboardChecklist,
  type OnboardDraft,
  type OnboardStep,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";
import {
  getOnboardedBarangay,
  hydrateOnboardedBarangays,
  listOnboardedBarangays,
  removeOnboardedBarangay,
  saveOnboardedBarangay,
} from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

const STEPS: { id: OnboardStep; label: string }[] = [
  { id: "orientation", label: "1 · Orientation" },
  { id: "pick", label: "2 · Pick" },
  { id: "hall", label: "3 · Hall pin" },
  { id: "org", label: "4 · Org" },
  { id: "checklist", label: "5 · Ops" },
  { id: "done", label: "6 · Done" },
];

const ORIENTATION_POINTS = [
  {
    title: "What LUWAS is",
    body: "LUWAS is the barangay command layer for DRRM — situation map, household roster, staff directory, and alert templates in one place.",
  },
  {
    title: "What you’ll set up",
    body: "Hall pin for the map, your MDRRMO / barangay org profile, then households, staff, and alert templates so ops can go live.",
  },
  {
    title: "Who this is for",
    body: "Punong Barangay, MDRRMO officers, and barangay staff who will run evacuate / prepare / monitor during typhoon and other hazards.",
  },
  {
    title: "From the LUWAS Devs",
    body: "UgnAI Labs built this playbook so every new barangay activates the same way. If something’s unclear, note it for Support — we iterate with field feedback.",
  },
] as const;

const OPS_ACTIONS = [
  {
    key: "householdsReady" as const,
    title: "House owners roster",
    hint: "Import CSV or add households for this barangay.",
    href: "/command/households",
    cta: "Open households",
  },
  {
    key: "staffReady" as const,
    title: "Staff / users",
    hint: "Punong barangay, MDRRMO, tanods on Users.",
    href: "/command/users",
    cta: "Open users",
  },
  {
    key: "templatesReviewed" as const,
    title: "Alert templates",
    hint: "Review SMS/email copy for evacuate / prepare.",
    href: "/bootstrap#email",
    cta: "Open templates",
  },
  {
    key: "mapOpened" as const,
    title: "Situation map",
    hint: "Open command map centered on this barangay hall.",
    href: "/command",
    cta: "Open map",
  },
] as const;

const ALL_OPTIONS = listMapAreaOptions();

type Props = {
  defaultOrgName?: string;
};

export function BarangayOnboardWizard({ defaultOrgName = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setActiveBarangay } = useAuth();
  const [draft, setDraft] = useState<OnboardDraft>(() => emptyDraft());
  const [activated, setActivated] = useState<OnboardedBarangay[]>([]);
  const [pickQuery, setPickQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  useEffect(() => {
    void hydrateOnboardedBarangays().then(setActivated);
  }, []);

  // Deep-link: /command/onboard?area=consolacion/tayud
  useEffect(() => {
    const areaId = searchParams.get("area");
    if (!areaId || draft.areaId) return;
    const option = ALL_OPTIONS.find((o) => o.id === areaId);
    if (option) void selectArea(option);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link
  }, [searchParams]);

  const pickResults = useMemo(
    () => filterMapAreaOptions(ALL_OPTIONS, pickQuery, 36),
    [pickQuery],
  );

  const stepIndex = STEPS.findIndex((s) => s.id === draft.step);

  async function selectArea(option: MapAreaOption) {
    setError(null);
    const existing = getOnboardedBarangay(option.id);
    if (existing) {
      setError(
        `${option.label} is already onboarded. Remove it below to re-run, or open Command.`,
      );
      return;
    }

    const known = resolveKnownMapArea(option);
    const orgGuess =
      defaultOrgName.trim() || `Brgy. ${option.barangay} MDRRMO`;

    setDraft((d) => ({
      ...d,
      step: "hall",
      areaId: option.id,
      barangay: option.barangay,
      lgu: option.lgu,
      name: option.name,
      orgName: d.orgName || orgGuess,
      hallAddress:
        d.hallAddress || `Brgy. ${option.barangay} Hall, ${option.lgu}`,
      center: known.center,
      zoom: known.zoom,
      resolvingHall: true,
    }));
    setPickQuery("");

    try {
      const res = await fetch("/api/geo/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(option),
      });
      if (res.ok) {
        const area = (await res.json()) as {
          center: { lat: number; lng: number };
          zoom: number;
        };
        setDraft((d) =>
          d.areaId === option.id
            ? {
                ...d,
                center: area.center,
                zoom: area.zoom ?? 15,
                resolvingHall: false,
              }
            : d,
        );
        return;
      }
    } catch {
      /* keep known */
    }
    setDraft((d) =>
      d.areaId === option.id ? { ...d, resolvingHall: false } : d,
    );
  }

  function setStep(step: OnboardStep) {
    setDraft((d) => ({ ...d, step }));
  }

  function markCheck(key: keyof OnboardChecklist, value = true) {
    setDraft((d) => ({
      ...d,
      checklist: { ...d.checklist, [key]: value },
    }));
  }

  function toggleCheck(key: keyof OnboardChecklist) {
    setDraft((d) => ({
      ...d,
      checklist: { ...d.checklist, [key]: !d.checklist[key] },
    }));
  }

  async function activate() {
    if (!draft.areaId || !draft.center) {
      setError("Pick a barangay and confirm the hall pin first.");
      return;
    }
    if (!draft.orgName.trim()) {
      setError("Org name is required.");
      setStep("org");
      return;
    }
    if (!draft.hotline.trim()) {
      setError("Hotline is required.");
      setStep("org");
      return;
    }

    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const row: OnboardedBarangay = {
      id: draft.areaId,
      barangay: draft.barangay,
      lgu: draft.lgu,
      name: draft.name,
      orgName: draft.orgName.trim(),
      hallAddress: draft.hallAddress.trim(),
      hotline: draft.hotline.trim(),
      email: draft.email.trim(),
      center: draft.center,
      zoom: draft.zoom,
      checklist: draft.checklist,
      activatedAt: now,
      updatedAt: now,
      activatedBy: user?.uid,
    };

    try {
      await saveOnboardedBarangay(row);
      setPreferredAreaId(row.id);
      if (user?.uid) {
        try {
          await setActiveBarangay(row.id, row.orgName);
        } catch (err) {
          console.warn("[onboarding] activeBarangay profile update failed", err);
        }
      }
      setActivated(listOnboardedBarangays());
      setDraft((d) => ({ ...d, step: "done" }));
      setSeedMsg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate");
    } finally {
      setSaving(false);
    }
  }

  async function runDemoSeed() {
    if (!user?.uid || !draft.areaId || !draft.center) {
      setError("Sign in as an officer to seed demo data.");
      return;
    }
    setSeeding(true);
    setSeedMsg(null);
    setError(null);
    try {
      const result = await seedDemoBarangayOps({
        officerUid: user.uid,
        areaId: draft.areaId,
        barangay: draft.barangay,
        orgName: draft.orgName.trim(),
        center: draft.center,
      });
      markCheck("householdsReady");
      markCheck("staffReady");
      const updated: OnboardedBarangay = {
        id: draft.areaId,
        barangay: draft.barangay,
        lgu: draft.lgu,
        name: draft.name,
        orgName: draft.orgName.trim(),
        hallAddress: draft.hallAddress.trim(),
        hotline: draft.hotline.trim(),
        email: draft.email.trim(),
        center: draft.center,
        zoom: draft.zoom,
        checklist: {
          ...draft.checklist,
          householdsReady: true,
          staffReady: true,
        },
        activatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activatedBy: user.uid,
      };
      await saveOnboardedBarangay(updated);
      setActivated(listOnboardedBarangays());
      setSeedMsg(
        `Demo seed ready — ${result.households} households · ${result.staff} staff.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo seed failed");
    } finally {
      setSeeding(false);
    }
  }

  function openCommand() {
    if (draft.areaId) setPreferredAreaId(draft.areaId);
    router.push(
      draft.areaId
        ? `/command?area=${encodeURIComponent(draft.areaId)}`
        : "/command",
    );
  }

  function resetWizard() {
    setDraft(emptyDraft());
    setError(null);
    setSeedMsg(null);
  }

  async function removeActivated(id: string) {
    if (!window.confirm("Remove this barangay from the onboarded list?")) return;
    await removeOnboardedBarangay(id);
    setActivated(listOnboardedBarangays());
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
            Go-live playbook
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide">
            Add a barangay to LUWAS ops
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Start with a short orientation from the LUWAS Devs, then activate a
            Cebu barangay: hall pin, MDRRMO profile, households / staff /
            templates.
          </p>
        </div>
        {draft.step !== "orientation" && draft.step !== "done" ? (
          <Button type="button" variant="outline" size="sm" onClick={resetWizard}>
            Start over
          </Button>
        ) : null}
      </header>

      <ol className="flex flex-wrap gap-1 border border-[var(--border)] bg-[var(--surface-panel)]/40 p-1">
        {STEPS.map((s, i) => {
          const needsArea =
            s.id !== "orientation" && s.id !== "pick" && s.id !== "done";
          const locked =
            (needsArea && !draft.areaId) ||
            (s.id === "done" && draft.step !== "done");
          const active = draft.step === s.id;
          const done = i < stepIndex;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={locked && !done}
                onClick={() => {
                  if (s.id === "done") return;
                  if (needsArea && !draft.areaId) return;
                  setStep(s.id);
                }}
                className={cn(
                  "px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
                  active
                    ? "bg-[var(--accent)] text-white"
                    : done
                      ? "text-[var(--accent)] hover:bg-[var(--surface-raised)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  locked && !done && "opacity-40",
                )}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {draft.step === "orientation" ? (
        <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            From the LUWAS Devs · UgnAI Labs
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
            Orientation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Quick briefing before you activate a barangay. Read through, then
            continue to pick your area.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {ORIENTATION_POINTS.map((item) => (
              <li
                key={item.title}
                className="border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setStep("pick")}>
              Continue to pick barangay
            </Button>
          </div>
        </section>
      ) : null}

      {draft.step === "pick" ? (
        <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Pick barangay
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            From the PhilAtlas Cebu directory. Already-onboarded rows are blocked
            until removed.
          </p>
          <input
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
            placeholder="Search barangay or LGU…"
            className="mt-4 w-full max-w-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <ul className="mt-3 max-h-80 divide-y divide-[var(--border)] overflow-y-auto border border-[var(--border)]">
            {pickResults.map((opt) => {
              const onboarded = activated.some((a) => a.id === opt.id);
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={onboarded}
                    onClick={() => void selectArea(opt)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--surface-panel)]/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      <span className="font-medium">{opt.barangay}</span>
                      <span className="text-[var(--muted)]"> · {opt.lgu}</span>
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      {onboarded ? "Onboarded" : "Select"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("orientation")}
            >
              Back
            </Button>
          </div>
        </section>
      ) : null}

      {draft.step === "hall" && draft.areaId ? (
        <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Hall pin · {draft.barangay}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Drag the pin or click the map to set the barangay hall. Geocode runs
            automatically when you pick an area
            {draft.resolvingHall ? " — resolving…" : "."}
          </p>
          <div className="mt-4">
            {draft.center ? (
              <HallPinMap
                center={draft.center}
                zoom={draft.zoom}
                onChange={({ center, zoom }) =>
                  setDraft((d) => ({ ...d, center, zoom }))
                }
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center border border-dashed border-[var(--border)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:h-[340px]">
                Waiting for hall coordinates…
              </div>
            )}
          </div>
          {draft.center ? (
            <p className="mt-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              {draft.center.lat.toFixed(5)}, {draft.center.lng.toFixed(5)} · zoom{" "}
              {draft.zoom}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("pick")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!draft.center || draft.resolvingHall}
              onClick={() => setStep("org")}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {draft.step === "org" && draft.areaId ? (
        <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            MDRRMO / barangay profile
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Shown on alerts and officer chrome for this barangay. Hotline
            required.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Org name
              </span>
              <input
                value={draft.orgName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, orgName: e.target.value }))
                }
                className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Hall address
              </span>
              <input
                value={draft.hallAddress}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, hallAddress: e.target.value }))
                }
                className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm">
              <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Hotline *
              </span>
              <input
                value={draft.hotline}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, hotline: e.target.value }))
                }
                placeholder="09xxxxxxxxx"
                className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm">
              <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Ops email
              </span>
              <input
                type="email"
                value={draft.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, email: e.target.value }))
                }
                className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("hall")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!draft.orgName.trim() || !draft.hotline.trim()}
              onClick={() => setStep("checklist")}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {draft.step === "checklist" && draft.areaId ? (
        <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Ops playbook
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open each tool, then mark done. You can activate now and finish these
            after — or seed demo data on the next screen.
          </p>
          <ul className="mt-4 grid gap-3">
            {OPS_ACTIONS.map((item) => {
              const done = draft.checklist[item.key];
              const href =
                item.key === "mapOpened" && draft.areaId
                  ? `/command?area=${encodeURIComponent(draft.areaId)}`
                  : item.href;
              return (
                <li
                  key={item.key}
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-3 border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4",
                    done && "border-[var(--accent)]/40 bg-[var(--accent)]/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.hint}
                    </p>
                    <p className="mt-2 font-mono text-[10px] tracking-wider uppercase text-[var(--muted)]">
                      {done ? "Done" : "Pending"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={href}
                      onClick={() => markCheck(item.key)}
                      className="border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-white uppercase transition hover:opacity-90"
                    >
                      {item.cta} →
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.key)}
                      className="border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      {done ? "Undo" : "Mark done"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("org")}
            >
              Back
            </Button>
            <Button type="button" disabled={saving} onClick={() => void activate()}>
              {saving ? "Activating…" : "Activate barangay"}
            </Button>
          </div>
        </section>
      ) : null}

      {draft.step === "done" && draft.areaId ? (
        <section className="border border-[var(--accent)]/40 bg-[var(--accent)]/8 p-4 sm:p-5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            You&apos;re live
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
            Brgy. {draft.barangay}, {draft.lgu}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {draft.orgName} · hall pin saved. Command will prefer this area.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Demo seed
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Drop ~24 sample households + a staff pyramid for Cup demos.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={seeding || !user}
                onClick={() => void runDemoSeed()}
              >
                {seeding ? "Seeding…" : "Seed demo roster"}
              </Button>
            </div>
            <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Import CSV
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Upload your real house-owner list in Households.
              </p>
              <Button asChild type="button" size="sm" variant="outline" className="mt-3">
                <Link
                  href="/command/households"
                  onClick={() => markCheck("householdsReady")}
                >
                  Open CSV import →
                </Link>
              </Button>
            </div>
          </div>

          {seedMsg ? (
            <p className="mt-3 text-sm text-[var(--accent)]">{seedMsg}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={openCommand}>
              Open command map
            </Button>
            <Button type="button" variant="outline" onClick={resetWizard}>
              Onboard another
            </Button>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Onboarded barangays
        </h2>
        {activated.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            None yet — pick a barangay above.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] border border-[var(--border)]">
            {activated.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {row.barangay} · {row.lgu}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {row.orgName} · {row.center.lat.toFixed(4)},{" "}
                    {row.center.lng.toFixed(4)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredAreaId(row.id);
                      void setActiveBarangay(row.id, row.orgName).catch(
                        () => undefined,
                      );
                      router.push(
                        `/command?area=${encodeURIComponent(row.id)}`,
                      );
                    }}
                    className="border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition hover:border-[var(--accent)]"
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeActivated(row.id)}
                    className="border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] tracking-wider text-[var(--danger)] uppercase transition hover:border-[var(--danger)]"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
