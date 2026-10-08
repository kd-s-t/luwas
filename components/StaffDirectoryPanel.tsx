"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ensureNangkaStaffSeed,
  subscribeBarangayStaff,
} from "@/lib/staff/api";
import {
  buildStaffForest,
  depthOf,
  sortStaff,
  type StaffTreeNode,
} from "@/lib/staff/hierarchy";
import { NANGKA_BARANGAY_ID, NANGKA_ORG_NAME } from "@/lib/staff/nangkaStaff";
import {
  staffRankLabel,
  type StaffMember,
  type StaffScope,
} from "@/lib/staff/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusTone(status: StaffMember["status"]) {
  if (status === "active") return "text-[var(--accent)]";
  if (status === "leave") return "text-[var(--warn)]";
  return "text-[var(--muted)]";
}

function HierarchyBranch({
  node,
  depth = 0,
}: {
  node: StaffTreeNode;
  depth?: number;
}) {
  const m = node.member;
  return (
    <li>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 border-[var(--border)] py-2 pl-3",
          depth === 0 && "border-l-[var(--accent)]",
        )}
        style={{ marginLeft: depth * 12 }}
      >
        <p className="text-sm font-medium text-[var(--foreground)]">
          {m.displayName}
        </p>
        <p className="text-xs text-[var(--muted)]">{m.title}</p>
        {m.accountEmail ? (
          <span className="font-mono text-[9px] tracking-wide text-[var(--accent)] uppercase">
            Login
          </span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((c) => (
            <HierarchyBranch key={c.member.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function StaffDirectoryPanel() {
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | StaffScope>("all");
  const seeded = useRef(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeBarangayStaff(
      NANGKA_BARANGAY_ID,
      (next) => {
        setRows(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (seeded.current || loading) return;
    seeded.current = true;
    void ensureNangkaStaffSeed().catch(() => {
      seeded.current = false;
    });
  }, [loading, rows.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((h) => {
        if (scope !== "all" && h.scope !== scope) return false;
        if (!q) return true;
        const hay = [
          h.displayName,
          h.title,
          h.office,
          h.phone,
          h.email,
          h.notes ?? "",
          staffRankLabel(h.rank),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(sortStaff);
  }, [rows, search, scope]);

  const forest = useMemo(() => buildStaffForest(rows), [rows]);
  const brgyTree = useMemo(
    () => forest.filter((n) => n.member.scope === "barangay"),
    [forest],
  );
  const lguTree = useMemo(
    () => forest.filter((n) => n.member.scope === "lgu"),
    [forest],
  );

  const activeCount = rows.filter((r) => r.status === "active").length;
  const loginCount = rows.filter((r) => r.accountEmail).length;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
              Organization
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              Users &amp; hierarchy
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {NANGKA_ORG_NAME} — who works this barangay
            </p>
          </div>
          <p className="font-mono text-xs text-[var(--muted)]">
            {loading
              ? "…"
              : `${activeCount} active · ${loginCount} with login · ${rows.length} total`}
          </p>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="font-mono text-sm text-[var(--muted)]">
            Loading staff directory…
          </p>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] bg-[var(--surface-panel)]/50 px-5 py-10 text-[var(--muted)]">
            <p>No staff roster yet.</p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => {
                seeded.current = false;
                void ensureNangkaStaffSeed();
              }}
            >
              Seed Nangka staff
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-5 border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-4">
              <div>
                <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Hierarchy · Barangay
                </p>
                <ul className="mt-2">
                  {brgyTree.map((n) => (
                    <HierarchyBranch key={n.member.id} node={n} />
                  ))}
                </ul>
              </div>
              {lguTree.length > 0 ? (
                <div className="border-t border-[var(--border)] pt-4">
                  <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Hierarchy · LGU Consolacion
                  </p>
                  <ul className="mt-2">
                    {lguTree.map((n) => (
                      <HierarchyBranch key={n.member.id} node={n} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 sm:px-4">
                <label className="block">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Search
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, title, office, phone…"
                    className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[8rem]">
                    <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      Scope
                    </span>
                    <select
                      value={scope}
                      onChange={(e) =>
                        setScope(e.target.value as "all" | StaffScope)
                      }
                      className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                    >
                      <option value="all">All</option>
                      <option value="barangay">Barangay</option>
                      <option value="lgu">LGU</option>
                    </select>
                  </label>
                  {(search || scope !== "all") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setScope("all");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                  Showing {filtered.length} of {rows.length}
                </p>
              </div>

              {filtered.length === 0 ? (
                <div className="border border-dashed border-[var(--border)] px-5 py-10 text-center">
                  <p className="font-medium text-[var(--foreground)]">
                    No users match
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Try another scope or search term.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--border)]">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Name</th>
                        <th className="px-3 py-2.5 font-medium">Title</th>
                        <th className="px-3 py-2.5 font-medium">Reports to</th>
                        <th className="px-3 py-2.5 font-medium">Contact</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => {
                        const boss = rows.find((r) => r.id === m.reportsToId);
                        const pad = depthOf(m.id, rows);
                        return (
                          <tr
                            key={m.id}
                            className="border-b border-[var(--border)]/70 last:border-0"
                          >
                            <td className="px-3 py-2.5 align-top">
                              <p
                                className="font-medium"
                                style={{ paddingLeft: pad * 10 }}
                              >
                                {m.displayName}
                              </p>
                              <p className="font-mono text-[10px] text-[var(--muted)] uppercase">
                                {m.scope === "lgu" ? "LGU" : "Barangay"} ·{" "}
                                {staffRankLabel(m.rank)}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                              {m.title}
                              <p className="mt-0.5 text-xs">{m.office}</p>
                            </td>
                            <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                              {boss?.displayName ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 align-top font-mono text-xs text-[var(--muted)]">
                              <p>{m.phone}</p>
                              <p className="break-all">{m.email}</p>
                              {m.accountEmail ? (
                                <p className="mt-0.5 text-[var(--accent)]">
                                  Can sign in
                                </p>
                              ) : null}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2.5 align-top font-mono text-[10px] tracking-wide uppercase",
                                statusTone(m.status),
                              )}
                            >
                              {m.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
