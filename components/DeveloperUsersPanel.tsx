"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { AccountStatus, UserProfile } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type WorkFilter = "all" | AccountStatus;

function workStatus(u: UserProfile): AccountStatus | "active" {
  return u.accountStatus ?? "active";
}

function workLabel(status: AccountStatus | "active"): string {
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "fired") return "Former / fired";
  return "Active";
}

function mapDoc(id: string, data: Record<string, unknown>): UserProfile {
  const roleRaw = String(data.role ?? "officer");
  const role =
    roleRaw === "citizen"
      ? "citizen"
      : roleRaw === "developer"
        ? "developer"
        : "officer";
  const base = {
    uid: String(data.uid ?? id),
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    createdAt: String(data.createdAt ?? ""),
    accountStatus: data.accountStatus as AccountStatus | undefined,
    barangay: data.barangay != null ? String(data.barangay) : null,
    lgu: data.lgu != null ? String(data.lgu) : null,
    areaId: data.areaId != null ? String(data.areaId) : null,
  };
  if (role === "developer") {
    return {
      ...base,
      role: "developer",
      orgName: String(data.orgName ?? "UGNAI Developers"),
    };
  }
  if (role === "citizen") {
    return {
      ...base,
      role: "citizen",
      purok: String(data.purok ?? ""),
      phone: String(data.phone ?? ""),
    };
  }
  return {
    ...base,
    role: "officer",
    orgName: String(data.orgName ?? ""),
    officerTitle:
      data.officerTitle != null ? String(data.officerTitle) : null,
    officerRank:
      data.officerRank === "captain" || data.officerRank === "officer"
        ? data.officerRank
        : undefined,
  };
}

const FILTERS: { id: WorkFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "fired", label: "Former" },
  { id: "rejected", label: "Rejected" },
];

export function DeveloperUsersPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "officer" | "citizen" | "developer"
  >("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(getClientDb(), "users"),
      (snap) => {
        const rows: UserProfile[] = [];
        for (const d of snap.docs) {
          rows.push(mapDoc(d.id, d.data() as Record<string, unknown>));
        }
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setUsers(rows);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const c = {
      all: users.length,
      active: 0,
      pending: 0,
      fired: 0,
      rejected: 0,
    };
    for (const u of users) {
      const s = workStatus(u);
      if (s === "pending") c.pending += 1;
      else if (s === "fired") c.fired += 1;
      else if (s === "rejected") c.rejected += 1;
      else c.active += 1;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      const status = workStatus(u);
      if (filter === "active" && status !== "active") return false;
      if (filter === "pending" && status !== "pending") return false;
      if (filter === "fired" && status !== "fired") return false;
      if (filter === "rejected" && status !== "rejected") return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!needle) return true;
      const hay = [
        u.displayName,
        u.email,
        u.barangay ?? "",
        u.lgu ?? "",
        u.areaId ?? "",
        u.role === "officer" ? u.orgName : "",
        u.role === "officer" ? (u.officerTitle ?? "") : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [users, filter, roleFilter, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Users
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          All accounts across barangays. Filter by work status (job /
          employment).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm ring-1 transition",
              filter === f.id
                ? "bg-[#0f1b2d] text-white ring-[#0f1b2d]"
                : "bg-white text-[var(--foreground)] ring-[var(--border)] hover:ring-[var(--foreground)]/30",
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums text-[11px] opacity-70">
              {f.id === "all"
                ? counts.all
                : f.id === "active"
                  ? counts.active
                  : f.id === "pending"
                    ? counts.pending
                    : f.id === "fired"
                      ? counts.fired
                      : counts.rejected}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All roles"],
            ["officer", "Officers"],
            ["citizen", "Citizens"],
            ["developer", "Developers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRoleFilter(id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition",
              roleFilter === id
                ? "bg-white ring-[#1d4ed8] text-[#1d4ed8]"
                : "bg-white/70 text-[var(--muted)] ring-[var(--border)]",
            )}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, barangay…"
          className="min-w-[14rem] flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1d4ed8]"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            Loading users…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No users match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[#f7f8fa] text-[11px] tracking-wide text-[var(--muted)] uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Work status</th>
                  <th className="px-4 py-2.5 font-medium">Barangay</th>
                  <th className="px-4 py-2.5 font-medium">Title / org</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const status = workStatus(u);
                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-[var(--border)]/70 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--foreground)]">
                          {u.displayName || "—"}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--muted)]">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize text-[var(--muted)]">
                        {u.role}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                            status === "active"
                              ? "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/50"
                              : status === "pending"
                                ? "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/50"
                                : "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]/60",
                          )}
                        >
                          {workLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {u.barangay
                          ? `${u.barangay}${u.lgu ? ` · ${u.lgu}` : ""}`
                          : u.areaId || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {u.role === "officer"
                          ? u.officerTitle || u.orgName || "—"
                          : u.role === "developer"
                            ? u.orgName || "—"
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        Showing {filtered.length} of {users.length} users
      </p>
    </div>
  );
}
