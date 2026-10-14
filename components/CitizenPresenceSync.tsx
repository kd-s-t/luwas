"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isCitizen } from "@/lib/auth/types";
import { syncCitizenPresenceFromDevice } from "@/lib/households/citizenPresence";

const REFRESH_MS = 5 * 60_000;

/**
 * While a citizen is signed in, refresh GPS lastSeen* periodically.
 * Immediate post-login sync lives on the citizen login submit path.
 */
export function CitizenPresenceSync() {
  const { profile } = useAuth();
  const lastOkAt = useRef(0);

  const uid = profile?.uid ?? "";
  const email = profile?.email ?? "";
  const barangay = profile?.barangay?.trim() || "";
  const canSync =
    isCitizen(profile) && isAccountActive(profile) && Boolean(uid && email);

  useEffect(() => {
    if (!canSync) return;

    let cancelled = false;

    async function locate() {
      if (cancelled) return;
      const ok = await syncCitizenPresenceFromDevice({
        uid,
        email,
        barangay,
      }).catch(() => false);
      if (ok) lastOkAt.current = Date.now();
    }

    // Session refresh only; login page already syncs on submit.
    const startId = window.setTimeout(locate, 2_000);
    const intervalId = window.setInterval(() => {
      if (Date.now() - lastOkAt.current < REFRESH_MS - 5_000) return;
      void locate();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [canSync, uid, email, barangay]);

  return null;
}
