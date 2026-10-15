"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EeRunJob, EeRunMeta } from "@/lib/geo/eeRunTypes";
import { cn } from "@/lib/utils";

type ActiveFile = {
  name: string;
  bytes: number;
  mtime: string | null;
};

type RunsResponse = {
  ready: boolean;
  busy: boolean;
  projectId: string | null;
  error: string | null;
  activeFiles: ActiveFile[];
  runs: EeRunMeta[];
};

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function jobLabel(job: EeRunJob): string {
  if (job === "dem") return "DEM";
  if (job === "hazards") return "Hazards";
  return "DEM + Hazards";
}

function statusVariant(
  status: EeRunMeta["status"],
): "success" | "warn" | "danger" | "outline" {
  if (status === "ok") return "success";
  if (status === "running") return "warn";
  if (status === "failed") return "danger";
  return "outline";
}

export function EarthEngineAdminPanel() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<EeRunJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/geo/earth-engine/runs", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const json = (await res.json()) as RunsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startJob(job: EeRunJob) {
    setRunning(job);
    setError(null);
    try {
      const res = await fetch("/api/geo/earth-engine/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          triggeredBy:
            profile?.displayName ||
            profile?.email ||
            user?.email ||
            "officer",
        }),
      });
      const json = (await res.json()) as { run?: EeRunMeta; error?: string };
      if (!res.ok && !json.run) {
        throw new Error(json.error || `Run failed (${res.status})`);
      }
      if (json.run?.status === "failed") {
        setError(json.run.error || "Earth Engine run failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await load();
    } finally {
      setRunning(null);
    }
  }

  const busy = Boolean(running || data?.busy);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Geospatial
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Earth Engine
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Manual Cebu DEM / hazard pull. Not automated — run when you need fresh
          cache. Files are downloadable; each run is kept in history.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={data?.ready ? "success" : "danger"}>
            {data?.ready ? "Ready" : "Not ready"}
          </Badge>
          {busy ? <Badge variant="warn">Running</Badge> : null}
          <span className="font-mono text-[11px] text-[var(--muted)]">
            Project · {data?.projectId || "—"}
          </span>
        </div>
        {data?.error ? (
          <p className="mt-2 text-xs text-[var(--danger)]">{data.error}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || loading}
            onClick={() => void startJob("dem")}
          >
            {running === "dem" ? "Pulling DEM…" : "Run DEM"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || loading}
            onClick={() => void startJob("hazards")}
          >
            {running === "hazards" ? "Pulling hazards…" : "Run hazards"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="dark"
            disabled={busy || loading}
            onClick={() => void startJob("both")}
          >
            {running === "both" ? "Running both…" : "Run DEM + hazards"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Refresh
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>
        ) : null}
      </div>

      <section>
        <h3 className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Active cache
        </h3>
        <div className="mt-2 overflow-x-auto border border-[var(--border)] bg-[var(--surface-raised)]">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">File</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Updated</th>
                <th className="px-3 py-2.5 font-medium">Download</th>
              </tr>
            </thead>
            <tbody>
              {(data?.activeFiles ?? []).map((f) => (
                <tr
                  key={f.name}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-3 py-2.5 font-mono text-xs">{f.name}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {formatBytes(f.bytes)}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {formatWhen(f.mtime)}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.bytes > 0 ? (
                      <a
                        href={`/api/geo/earth-engine/active/${encodeURIComponent(f.name)}`}
                        className="font-mono text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Missing</span>
                    )}
                  </td>
                </tr>
              ))}
              {loading && !data ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-[var(--muted)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Run history
        </h3>
        <div className="mt-2 overflow-x-auto border border-[var(--border)] bg-[var(--surface-raised)]">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">Started</th>
                <th className="px-3 py-2.5 font-medium">Job</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">By</th>
                <th className="px-3 py-2.5 font-medium">Files</th>
              </tr>
            </thead>
            <tbody>
              {(data?.runs ?? []).length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                  >
                    No runs yet. Use the buttons above to pull Cebu data.
                  </td>
                </tr>
              ) : null}
              {(data?.runs ?? []).map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-[var(--border)] align-top last:border-0"
                >
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {formatWhen(run.startedAt)}
                  </td>
                  <td className="px-3 py-3">{jobLabel(run.job)}</td>
                  <td className="px-3 py-3">
                    <Badge variant={statusVariant(run.status)}>
                      {run.status}
                    </Badge>
                    {run.error ? (
                      <p className="mt-1 max-w-xs text-[11px] text-[var(--danger)]">
                        {run.error}
                      </p>
                    ) : null}
                    {run.counts ? (
                      <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                        {Object.entries(run.counts)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {run.triggeredBy || "—"}
                  </td>
                  <td className="px-3 py-3">
                    {run.files.length === 0 ? (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {run.files.map((f) => (
                          <li key={f.name} className="flex items-center gap-2">
                            <a
                              href={`/api/geo/earth-engine/runs/${encodeURIComponent(run.id)}/files/${encodeURIComponent(f.name)}`}
                              className={cn(
                                "font-mono text-xs text-[var(--accent)] underline-offset-2 hover:underline",
                              )}
                            >
                              {f.name}
                            </a>
                            <span className="text-[10px] text-[var(--muted)]">
                              {formatBytes(f.bytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
