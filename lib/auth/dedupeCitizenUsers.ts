import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

type CitizenRow = {
  uid: string;
  email: string;
  accountStatus: string;
  householdId: string;
  phone: string;
  displayName: string;
};

function score(u: CitizenRow): number {
  let s = 0;
  if (u.accountStatus === "active" || !u.accountStatus) s += 10;
  if (u.householdId) s += 5;
  if (u.phone) s += 1;
  if (u.displayName) s += 1;
  if (!u.uid.startsWith("pending-")) s += 2;
  return s;
}

/**
 * Delete orphan citizen `users` docs that share an email (keep the strongest).
 * Requires Firestore rules that allow officers to delete citizen profiles.
 */
export async function dedupeCitizenUsersByEmail(): Promise<{
  deleted: number;
  emails: string[];
}> {
  const db = getClientDb();
  const snap = await getDocs(collection(db, "users"));
  const byEmail = new Map<string, CitizenRow[]>();

  for (const d of snap.docs) {
    const data = d.data();
    if (String(data.role ?? "") !== "citizen") continue;
    const email = String(data.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) continue;
    const row: CitizenRow = {
      uid: d.id,
      email,
      accountStatus: String(data.accountStatus ?? ""),
      householdId: String(data.householdId ?? ""),
      phone: String(data.phone ?? ""),
      displayName: String(data.displayName ?? ""),
    };
    const list = byEmail.get(email) ?? [];
    list.push(row);
    byEmail.set(email, list);
  }

  const deletedUids: string[] = [];
  const touchedEmails: string[] = [];

  for (const [email, rows] of byEmail) {
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => score(b) - score(a));
    const drop = ranked.slice(1);
    for (const u of drop) {
      await deleteDoc(doc(db, "users", u.uid));
      deletedUids.push(u.uid);
    }
    if (drop.length) touchedEmails.push(email);
  }

  if (deletedUids.length) {
    const dead = new Set(deletedUids);
    const households = await getDocs(collection(db, "households"));
    const now = new Date().toISOString();
    for (const h of households.docs) {
      const linkedRaw = Array.isArray(h.data().linkedCitizenUids)
        ? h.data().linkedCitizenUids.map(String)
        : [];
      const next = linkedRaw.filter((uid: string) => !dead.has(uid));
      if (next.length !== linkedRaw.length) {
        await updateDoc(doc(db, "households", h.id), {
          linkedCitizenUids: next,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
        });
      }
    }
  }

  return { deleted: deletedUids.length, emails: touchedEmails };
}
