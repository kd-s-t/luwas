"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EeRunJob, EeRunMeta } from "@/lib/geo/eeRunTypes";
import { cn } from "@/lib/utils";

type DatasetRow = {
  name: string;
  bytes: number;
  mtime: string | null;
  datasetId?: string;
};

type RunsResponse = {
  ready: boolean;
  busy: boolean;
  projectId: string | null;
  error: string | null;
  storageBucket?: string | null;
  activeFiles: DatasetRow[];
  datasets?: DatasetRow[];
  runs: EeRunMeta[];
};

function formatBytes(n: number): string {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fileLabel(name: string): string {
  if (name === "cebu-ee-dem.json") return "Cebu DEM";
  if (name === "nangka-ee-dem.json") return "Nangka DEM";
  if (name === "cebu-ee-hazards.json") return "Cebu hazards";
  return name.replace(/\.json$/i, "");
}

function jobLabel(job: EeRunJob): string {
  if (job === "dem") return "DEM";
  if (job === "hazards") return "Hazards";
  return "Engine";
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
  const files = data?.datasets ?? data?.activeFiles ?? [];
  const runs = data?.runs ?? [];
  const freshest = files.reduce<string | null>((best, f) => {
    if (!f.mtime) return best;
    if (!best) return f.mtime;
    return Date.parse(f.mtime) > Date.parse(best) ? f.mtime : best;
  }, null);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden border border-[var(--border)] bg-[linear-gradient(135deg,var(--surface-raised)_0%,var(--surface)_45%,color-mix(in_srgb,var(--accent)_6%,var(--surface))_100%)] px-5 py-6 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Geospatial
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide">
              Earth Engine
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--muted)]">
              <span className="font-mono">
                {data?.projectId || "—"}
              </span>
              {freshest ? (
                <>
                  <span aria-hidden className="text-[var(--border)]">
                    ·
                  </span>
                  <span>Updated {formatWhen(freshest)}</span>
                </>
              ) : null}
              {busy ? <Badge variant="warn">Running</Badge> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={busy || loading}
              onClick={() => void startJob("both")}
            >
              {running === "both" ? "Running engine…" : "Run engine"}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10"
              disabled={loading || busy}
              aria-label="Refresh"
              title="Refresh"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RefreshCw
                className={cn("size-4", loading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
        {data?.error || error ? (
          <p className="relative mt-4 text-xs text-[var(--danger)]">
            {error || data?.error}
          </p>
        ) : null}
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
            Database
          </h3>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            {files.filter((f) => f.bytes > 0).length}/{files.length || 0} rows
          </span>
        </div>
        <ul className="divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--surface)]">
          {loading && !data ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              Loading…
            </li>
          ) : null}
          {!loading && files.every((f) => f.bytes === 0) ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No rows yet. Run engine to write Cebu DEM and hazards to the
              database.
            </li>
          ) : null}
          {files.map((f) => (
            <li
              key={f.name}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-[var(--surface-raised)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tracking-tight">
                  {fileLabel(f.name)}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                  {f.datasetId
                    ? `ee_datasets/${f.datasetId}`
                    : f.name}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--muted)]">
                <span className="tabular-nums">{formatBytes(f.bytes)}</span>
                <span className="hidden min-w-[10.5rem] sm:inline">
                  {formatWhen(f.mtime)}
                </span>
                {f.bytes > 0 ? (
                  <a
                    href={`/api/geo/earth-engine/active/${encodeURIComponent(f.name)}`}
                    className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    Download
                  </a>
                ) : (
                  <span>Missing</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
            Run history
          </h3>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            {runs.length} run{runs.length === 1 ? "" : "s"}
          </span>
        </div>
        {runs.length === 0 && !loading ? (
          <div className="border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            No runs yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {jobLabel(run.job)}
                      </span>
                      <Badge variant={statusVariant(run.status)}>
                        {run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {formatWhen(run.startedAt)}
                      {run.triggeredBy ? ` · ${run.triggeredBy}` : ""}
                    </p>
                    {run.error ? (
                      <p className="mt-2 max-w-xl text-[11px] text-[var(--danger)]">
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
                  </div>
                  <div className="min-w-0">
                    {run.files.length === 0 ? (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    ) : (
                      <ul className="space-y-1 text-right">
                        {run.files.map((f) => (
                          <li key={f.name}>
                            <a
                              href={`/api/geo/earth-engine/runs/${encodeURIComponent(run.id)}/files/${encodeURIComponent(f.name)}`}
                              className="font-mono text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                            >
                              {f.name}
                            </a>
                            <span className="ml-2 text-[10px] text-[var(--muted)]">
                              {formatBytes(f.bytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
