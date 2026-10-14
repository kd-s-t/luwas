"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
  approvePendingAccount,
  markPendingAccountCalled,
  officerScopeBarangay,
  rejectPendingAccount,
  type PendingAccount,
} from "@/lib/auth/accountValidation";
import { ensurePendingSampleAccounts } from "@/lib/auth/ensurePendingSampleAccounts";
import { notifyAccountDecision } from "@/lib/auth/notifyAccountDecision";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isCitizen, isOfficer } from "@/lib/auth/types";
import { toE164Ph } from "@/lib/alerts/phones";
import { phoneToTelHref } from "@/lib/geo/responderStations";
import { Button } from "@/components/ui/button";

export function AccountValidationPanel({
  roleFilter,
}: {
  /** When set, only show pending accounts of this role. */
  roleFilter?: "citizen" | "officer";
} = {}) {
  const { profile } = useAuth();
  const { pendingAccounts } = useCommandWorkspace();
  const barangay = isOfficer(profile)
    ? officerScopeBarangay(profile)
    : "Nangka";

  const [busyId, setBusyId] = useState<string | null>(null);
  const [calledLocal, setCalledLocal] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const samplesSeeded = useRef(false);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    if (samplesSeeded.current) return;
    samplesSeeded.current = true;
    void import("@/lib/config/simulation").then(({ isSimulationOn }) => {
      if (!isSimulationOn()) return;
      return ensurePendingSampleAccounts().catch((err) => {
        samplesSeeded.current = false;
        console.error("[pending samples]", err);
      });
    });
  }, [profile]);

  const canModerate = useMemo(
    () => isOfficer(profile) && isAccountActive(profile),
    [profile],
  );

  const visible = useMemo(
    () =>
      roleFilter
        ? pendingAccounts.filter((r) => r.role === roleFilter)
        : pendingAccounts,
    [pendingAccounts, roleFilter],
  );

  if (!canModerate) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only active officers can validate registrations.
      </p>
    );
  }

  async function onCall(row: PendingAccount, telHref: string) {
    setError(null);
    window.location.href = telHref;
    setCalledLocal((prev) => ({ ...prev, [row.uid]: true }));
    try {
      await markPendingAccountCalled(row.uid);
    } catch (err) {
      console.warn("[mark called]", err);
    }
  }

  async function onConfirm(row: PendingAccount) {
    const called =
      calledLocal[row.uid] ||
      (isCitizen(row) && Boolean(row.officerCalledAt));
    if (isCitizen(row) && row.phone && !called) {
      const ok = window.confirm(
        `Call ${row.displayName} at ${row.phone} first?\n\nOK = confirm without call · Cancel = go back`,
      );
      if (!ok) return;
    }
    setBusyId(row.uid);
    setError(null);
    try {
      await approvePendingAccount(row);
      await notifyAccountDecision({
        decision: "approved",
        email: row.email,
        name: row.displayName,
        barangay: row.barangay,
        lgu: row.lgu,
        purok: isCitizen(row) ? row.purok : null,
        phone: isCitizen(row) ? row.phone : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row: PendingAccount) {
    setBusyId(row.uid);
    setError(null);
    try {
      await rejectPendingAccount(row.uid);
      await notifyAccountDecision({
        decision: "rejected",
        email: row.email,
        name: row.displayName,
        barangay: row.barangay,
        lgu: row.lgu,
        purok: isCitizen(row) ? row.purok : null,
        phone: isCitizen(row) ? row.phone : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Officer intervention
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          {roleFilter === "officer"
            ? "Pending officers"
            : roleFilter === "citizen"
              ? "Pending citizens"
              : "Pending registrations"}
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Brgy. {barangay} · Gemini invalid / no homeowner match → manual call,
          then confirm (email sent)
        </p>
      </div>
      {error ? (
        <p className="px-4 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No pending{" "}
          {roleFilter === "officer"
            ? "officers"
            : roleFilter === "citizen"
              ? "citizens"
              : "accounts"}{" "}
          for this barangay.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {visible.map((r) => {
            const phoneRaw = isCitizen(r) ? r.phone : "";
            const phoneE164 = toE164Ph(phoneRaw);
            const telHref = phoneE164
              ? phoneToTelHref(phoneE164)
              : phoneRaw.trim()
                ? phoneToTelHref(phoneRaw)
                : null;
            const called =
              calledLocal[r.uid] ||
              (isCitizen(r) && Boolean(r.officerCalledAt));

            return (
              <li
                key={r.uid}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ProfileAvatar
                    name={r.displayName || r.email}
                    photoURL={r.photoURL}
                    seed={r.displayName || r.email}
                    size="md"
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.displayName}</p>
                      <span className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase text-[var(--muted)]">
                        {r.role}
                      </span>
                      {r.idVerified ? (
                        <span className="border border-[var(--accent)]/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-[var(--accent)] uppercase">
                          Gemini valid
                        </span>
                      ) : (
                        <span className="border border-[var(--warn)]/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                          Gemini invalid
                        </span>
                      )}
                      {called ? (
                        <span className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                          Called
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {r.email}
                      {isCitizen(r) ? ` · ${r.phone} · ${r.purok}` : null}
                      {r.role === "officer" ? ` · ${r.orgName}` : null}
                    </p>
                    {isCitizen(r) && r.idExtractedName ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        ID name · {r.idExtractedName}
                      </p>
                    ) : null}
                    {r.idReason ? (
                      <p className="mt-1 text-xs text-[var(--foreground)]">
                        Gemini · {r.idReason}
                      </p>
                    ) : null}
                    {r.barangay ? (
                      <p className="mt-1 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                        {r.barangay}
                        {r.lgu ? `, ${r.lgu}` : ""}
                      </p>
                    ) : null}
                    {isCitizen(r) &&
                    (r.idDocumentUrl || r.faceDocumentUrl) ? (
                      <div className="mt-2 flex gap-2">
                        {r.idDocumentUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.idDocumentUrl}
                            alt="ID"
                            className="h-14 w-20 object-cover border border-[var(--border)]"
                          />
                        ) : null}
                        {r.faceDocumentUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.faceDocumentUrl}
                            alt="Face"
                            className="h-14 w-14 object-cover border border-[var(--border)]"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {telHref ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.uid}
                      onClick={() => void onCall(r, telHref)}
                    >
                      Call {phoneE164 ?? phoneRaw}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.uid}
                    onClick={() => void onReject(r)}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === r.uid}
                    onClick={() => void onConfirm(r)}
                  >
                    Confirm
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
