import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type {
  AccountStatus,
  EmploymentEvent,
  OfficerProfile,
  OfficerRank,
  UserProfile,
} from "@/lib/auth/types";
import { linkCitizenToHousehold } from "@/lib/households/match";

export type PendingAccount = UserProfile & {
  accountStatus: "pending";
};

/** Barangay label for the signed-in gov official (roster scope). */
export function officerScopeBarangay(
  profile: OfficerProfile | null | undefined,
): string {
  if (!profile) return "";
  const fromField = profile.barangay?.trim();
  if (fromField) return fromField;
  const fromOrg = profile.orgName
    .replace(/^Brgy\.\s*/i, "")
    .split(/[·|,]/)[0]
    ?.trim();
  return fromOrg || "Nangka";
}

/** Whether a user belongs to this barangay / area (client filter). */
export function userMatchesBarangay(
  u: UserProfile,
  barangay: string,
  areaId?: string | null,
): boolean {
  const brgy = barangay.trim().toLowerCase();
  if (!brgy) return false;
  const userBrgy = (u.barangay ?? "").trim().toLowerCase();
  if (userBrgy && userBrgy === brgy) return true;
  const area = (areaId ?? "").trim().toLowerCase();
  if (area) {
    const theirArea = (u.areaId ?? "").trim().toLowerCase();
    if (theirArea && theirArea === area) return true;
    if (
      u.role === "officer" &&
      (u.activeBarangayId ?? "").trim().toLowerCase() === area
    ) {
      return true;
    }
  }
  if (u.role === "officer" && u.orgName.toLowerCase().includes(brgy)) {
    return true;
  }
  return false;
}

function mapUser(id: string, data: Record<string, unknown>): UserProfile {
  const role = data.role === "citizen" ? "citizen" : "officer";
  const base = {
    uid: String(data.uid ?? id),
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    createdAt: String(data.createdAt ?? ""),
    accountStatus: (data.accountStatus as AccountStatus | undefined) ?? undefined,
    barangay: data.barangay != null ? String(data.barangay) : null,
    lgu: data.lgu != null ? String(data.lgu) : null,
    areaId: data.areaId != null ? String(data.areaId) : null,
    photoURL: data.photoURL != null ? String(data.photoURL) : null,
    idVerified: Boolean(data.idVerified),
  };
  if (role === "citizen") {
    return {
      ...base,
      role: "citizen",
      purok: String(data.purok ?? ""),
      phone: String(data.phone ?? ""),
      householdId: data.householdId != null ? String(data.householdId) : null,
    };
  }
  const historyRaw = Array.isArray(data.employmentHistory)
    ? data.employmentHistory
    : [];
  const employmentHistory: EmploymentEvent[] = [];
  for (const ev of historyRaw) {
    if (!ev || typeof ev !== "object") continue;
    const row = ev as Record<string, unknown>;
    const action = row.action === "fired" ? "fired" : "hired";
    employmentHistory.push({
      at: String(row.at ?? ""),
      byUid: String(row.byUid ?? ""),
      byName: String(row.byName ?? ""),
      action,
      reason: row.reason != null ? String(row.reason) : undefined,
      title: row.title != null ? String(row.title) : undefined,
    });
  }
  const rankRaw = data.officerRank;
  const officerRank: OfficerRank | undefined =
    rankRaw === "captain" || rankRaw === "officer" ? rankRaw : undefined;
  return {
    ...base,
    role: "officer",
    orgName: String(data.orgName ?? ""),
    activeBarangayId:
      data.activeBarangayId != null ? String(data.activeBarangayId) : null,
    officerRank,
    officerTitle:
      data.officerTitle != null ? String(data.officerTitle) : null,
    staffId: data.staffId != null ? String(data.staffId) : null,
    reportsToStaffId:
      data.reportsToStaffId != null ? String(data.reportsToStaffId) : null,
    staffRank: data.staffRank != null ? String(data.staffRank) : null,
    hiredAt: data.hiredAt != null ? String(data.hiredAt) : null,
    hiredByUid: data.hiredByUid != null ? String(data.hiredByUid) : null,
    firedAt: data.firedAt != null ? String(data.firedAt) : null,
    firedByUid: data.firedByUid != null ? String(data.firedByUid) : null,
    firedReason:
      data.firedReason != null ? String(data.firedReason) : null,
    employmentHistory,
  };
}

/** True if no other active officer exists for this barangay/area. */
export async function isFirstActiveOfficerInBarangay(
  areaId: string,
  barangay: string,
): Promise<boolean> {
  const db = getClientDb();
  const snap = await getDocs(
    query(collection(db, "users"), where("role", "==", "officer")),
  );
  const brgy = barangay.trim().toLowerCase();
  const area = areaId.trim().toLowerCase();
  for (const d of snap.docs) {
    const data = d.data();
    const status = data.accountStatus as string | undefined;
    if (status === "pending" || status === "rejected" || status === "fired") {
      continue;
    }
    const theirArea = String(data.areaId ?? data.activeBarangayId ?? "").toLowerCase();
    const theirBrgy = String(data.barangay ?? "").toLowerCase();
    if (theirArea === area || (brgy && theirBrgy === brgy)) {
      return false;
    }
  }
  return true;
}

export function subscribePendingAccounts(
  barangay: string,
  onData: (rows: PendingAccount[]) => void,
  onError?: (err: Error) => void,
  areaId?: string | null,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "users"),
    where("accountStatus", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapUser(d.id, d.data()))
        .filter(
          (u) =>
            u.accountStatus === "pending" &&
            userMatchesBarangay(u, barangay, areaId),
        ) as PendingAccount[];
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

/** App accounts (officers + citizens) for one barangay. */
export function subscribeBarangayUsers(
  barangay: string,
  onData: (rows: UserProfile[]) => void,
  onError?: (err: Error) => void,
  areaId?: string | null,
): Unsubscribe {
  return onSnapshot(
    collection(getClientDb(), "users"),
    (snap) => {
      const rows = snap.docs
        .map((d) => mapUser(d.id, d.data()))
        .filter((u) => userMatchesBarangay(u, barangay, areaId));
      rows.sort((a, b) => {
        const roleCmp = a.role.localeCompare(b.role);
        if (roleCmp !== 0) return roleCmp;
        return (a.displayName || a.email).localeCompare(
          b.displayName || b.email,
        );
      });
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function setAccountStatus(
  uid: string,
  status: AccountStatus,
  opts?: { householdId?: string | null },
): Promise<void> {
  const payload: Record<string, unknown> = {
    accountStatus: status,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  };
  if (opts?.householdId != null) {
    payload.householdId = opts.householdId;
  }
  await updateDoc(doc(getClientDb(), "users", uid), payload);
  if (status === "active" && opts?.householdId) {
    await linkCitizenToHousehold(opts.householdId, uid);
  }
}

export async function approvePendingAccount(
  account: PendingAccount,
): Promise<void> {
  await setAccountStatus(account.uid, "active", {
    householdId:
      account.role === "citizen" ? account.householdId ?? null : undefined,
  });
  if (
    account.role === "citizen" &&
    account.householdId
  ) {
    await linkCitizenToHousehold(account.householdId, account.uid);
  }
}

export async function rejectPendingAccount(uid: string): Promise<void> {
  await setAccountStatus(uid, "rejected");
}
