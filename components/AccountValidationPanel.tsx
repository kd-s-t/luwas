"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  approvePendingAccount,
  officerScopeBarangay,
  rejectPendingAccount,
  subscribePendingAccounts,
  type PendingAccount,
} from "@/lib/auth/accountValidation";
import { ensurePendingSampleAccounts } from "@/lib/auth/ensurePendingSampleAccounts";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";

export function AccountValidationPanel() {
  const { profile } = useAuth();
  const barangay = isOfficer(profile)
    ? officerScopeBarangay(profile)
    : "Nangka";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;

  const [rows, setRows] = useState<PendingAccount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const samplesSeeded = useRef(false);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    if (!samplesSeeded.current) {
      samplesSeeded.current = true;
      void ensurePendingSampleAccounts().catch((err) => {
        samplesSeeded.current = false;
        console.error("[pending samples]", err);
      });
    }
    return subscribePendingAccounts(
      barangay,
      setRows,
      (err) => setError(err.message),
      areaId,
    );
  }, [profile, barangay, areaId]);

  const canModerate = useMemo(
    () => isOfficer(profile) && isAccountActive(profile),
    [profile],
  );

  if (!canModerate) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only active officers can validate registrations.
      </p>
    );
  }

  async function onApprove(row: PendingAccount) {
    setBusyId(row.uid);
    setError(null);
    try {
      await approvePendingAccount(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(uid: string) {
    setBusyId(uid);
    setError(null);
    try {
      await rejectPendingAccount(uid);
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
          Account validation
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          Pending registrations
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Brgy. {barangay} · citizens auto-validate when they match a house
          owner; officers need peer approval
        </p>
      </div>
      {error ? (
        <p className="px-4 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No pending accounts for this barangay.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li
              key={r.uid}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.displayName}</p>
                  <span className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase text-[var(--muted)]">
                    {r.role}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {r.email}
                  {r.role === "citizen" ? ` · ${r.phone} · ${r.purok}` : null}
                  {r.role === "officer" ? ` · ${r.orgName}` : null}
                </p>
                {r.barangay ? (
                  <p className="mt-1 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                    {r.barangay}
                    {r.lgu ? `, ${r.lgu}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === r.uid}
                  onClick={() => void onApprove(r)}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === r.uid}
                  onClick={() => void onReject(r.uid)}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
