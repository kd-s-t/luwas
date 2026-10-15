import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  EeRunFileMeta,
  EeRunJob,
  EeRunMeta,
} from "@/lib/geo/eeRunTypes";

export type {
  EeRunFileMeta,
  EeRunJob,
  EeRunMeta,
  EeRunStatus,
} from "@/lib/geo/eeRunTypes";

const ALLOWED_FILES = new Set([
  "cebu-ee-dem.json",
  "nangka-ee-dem.json",
  "cebu-ee-hazards.json",
  "meta.json",
]);

export function eeDataRoot(): string {
  return join(process.cwd(), "data");
}

export function eeRunsRoot(): string {
  return join(eeDataRoot(), "ee-runs");
}

export function eeRunDir(runId: string): string {
  return join(eeRunsRoot(), runId);
}

export function isAllowedEeFileName(name: string): boolean {
  return ALLOWED_FILES.has(name) && !name.includes("..") && !name.includes("/");
}

function ensureRunsRoot() {
  const root = eeRunsRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

function indexPath(): string {
  return join(eeRunsRoot(), "index.json");
}

function readIndex(): EeRunMeta[] {
  const path = indexPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row): row is EeRunMeta =>
        Boolean(row && typeof row === "object" && typeof (row as EeRunMeta).id === "string"),
    );
  } catch {
    return [];
  }
}

function writeIndex(rows: EeRunMeta[]) {
  ensureRunsRoot();
  writeFileSync(indexPath(), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

/** Newest first. */
export function listEeRuns(): EeRunMeta[] {
  ensureRunsRoot();
  const fromIndex = readIndex();
  if (fromIndex.length > 0) {
    return [...fromIndex].sort((a, b) =>
      (b.startedAt || "").localeCompare(a.startedAt || ""),
    );
  }

  // Rebuild from folders if index missing.
  const root = eeRunsRoot();
  const dirs = readdirSync(root).filter((name) => {
    try {
      return statSync(join(root, name)).isDirectory();
    } catch {
      return false;
    }
  });
  const rebuilt: EeRunMeta[] = [];
  for (const id of dirs) {
    const metaPath = join(root, id, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      rebuilt.push(JSON.parse(readFileSync(metaPath, "utf8")) as EeRunMeta);
    } catch {
      /* skip */
    }
  }
  rebuilt.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  if (rebuilt.length) writeIndex(rebuilt);
  return rebuilt;
}

export function getEeRun(runId: string): EeRunMeta | null {
  if (!runId || runId.includes("..") || runId.includes("/")) return null;
  const metaPath = join(eeRunDir(runId), "meta.json");
  if (!existsSync(metaPath)) {
    return listEeRuns().find((r) => r.id === runId) ?? null;
  }
  try {
    return JSON.parse(readFileSync(metaPath, "utf8")) as EeRunMeta;
  } catch {
    return null;
  }
}

export function createEeRunStub(input: {
  job: EeRunJob;
  triggeredBy?: string | null;
}): EeRunMeta {
  ensureRunsRoot();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = `${stamp}_${input.job}`;
  const dir = eeRunDir(id);
  mkdirSync(dir, { recursive: true });
  const meta: EeRunMeta = {
    id,
    job: input.job,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    projectId: null,
    provider: null,
    error: null,
    triggeredBy: input.triggeredBy ?? null,
    files: [],
  };
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  const rows = listEeRuns().filter((r) => r.id !== id);
  rows.unshift(meta);
  writeIndex(rows);
  return meta;
}

export function finalizeEeRun(
  runId: string,
  patch: Partial<
    Pick<
      EeRunMeta,
      | "status"
      | "finishedAt"
      | "projectId"
      | "provider"
      | "error"
      | "files"
      | "counts"
    >
  >,
): EeRunMeta {
  const dir = eeRunDir(runId);
  const prev = getEeRun(runId);
  if (!prev) {
    throw new Error(`Unknown Earth Engine run: ${runId}`);
  }
  const next: EeRunMeta = {
    ...prev,
    ...patch,
    finishedAt: patch.finishedAt ?? new Date().toISOString(),
  };
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  const rows = listEeRuns().map((r) => (r.id === runId ? next : r));
  writeIndex(rows);
  return next;
}

export function writeEeRunFile(
  runId: string,
  fileName: string,
  json: unknown,
): EeRunFileMeta {
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") {
    throw new Error(`Disallowed file: ${fileName}`);
  }
  const dir = eeRunDir(runId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const body = `${JSON.stringify(json, null, 2)}\n`;
  const path = join(dir, fileName);
  writeFileSync(path, body, "utf8");
  return { name: fileName, bytes: Buffer.byteLength(body, "utf8") };
}

export function readEeRunFile(
  runId: string,
  fileName: string,
): { body: Buffer; contentType: string } | null {
  if (!runId || runId.includes("..") || runId.includes("/")) return null;
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") return null;
  const path = join(eeRunDir(runId), fileName);
  if (!existsSync(path)) return null;
  return {
    body: readFileSync(path),
    contentType: "application/json; charset=utf-8",
  };
}

/** Live active cache files under `data/` (not a history run). */
export function listActiveEeCacheFiles(): {
  name: string;
  bytes: number;
  mtime: string | null;
}[] {
  const root = eeDataRoot();
  const names = [
    "cebu-ee-dem.json",
    "nangka-ee-dem.json",
    "cebu-ee-hazards.json",
  ] as const;
  return names.map((name) => {
    const path = join(root, name);
    if (!existsSync(path)) {
      return { name, bytes: 0, mtime: null };
    }
    const st = statSync(path);
    return {
      name,
      bytes: st.size,
      mtime: st.mtime.toISOString(),
    };
  });
}

export function readActiveEeCacheFile(
  fileName: string,
): { body: Buffer; contentType: string } | null {
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") return null;
  const path = join(eeDataRoot(), fileName);
  if (!existsSync(path)) return null;
  return {
    body: readFileSync(path),
    contentType: "application/json; charset=utf-8",
  };
}
