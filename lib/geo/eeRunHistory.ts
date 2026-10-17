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
import {
  gcsGetJson,
  gcsGetObject,
  gcsPutJson,
  mediaStorageBucket,
} from "@/lib/storage/gcsAdmin";

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

const EE_PREFIX = "ee-cache";

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

export function eeActiveObjectPath(fileName: string): string {
  return `${EE_PREFIX}/active/${fileName}`;
}

export function eeRunObjectPath(runId: string, fileName: string): string {
  return `${EE_PREFIX}/runs/${runId}/${fileName}`;
}

function eeIndexObjectPath(): string {
  return `${EE_PREFIX}/runs/index.json`;
}

function preferLocalDiskOnly(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
}

function ensureRunsRoot() {
  const root = eeRunsRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

function localIndexPath(): string {
  return join(eeRunsRoot(), "index.json");
}

function readLocalIndex(): EeRunMeta[] {
  const path = localIndexPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row): row is EeRunMeta =>
        Boolean(
          row &&
            typeof row === "object" &&
            typeof (row as EeRunMeta).id === "string",
        ),
    );
  } catch {
    return [];
  }
}

function writeLocalIndex(rows: EeRunMeta[]) {
  ensureRunsRoot();
  writeFileSync(localIndexPath(), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

function writeLocalFile(absPath: string, body: string) {
  const dir = absPath.slice(0, absPath.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(absPath, body, "utf8");
}

/** Newest first. Prefers Firebase Storage index. */
export async function listEeRuns(): Promise<EeRunMeta[]> {
  if (!preferLocalDiskOnly()) {
    try {
      const remote = await gcsGetJson<EeRunMeta[]>(eeIndexObjectPath());
      if (Array.isArray(remote) && remote.length > 0) {
        return [...remote].sort((a, b) =>
          (b.startedAt || "").localeCompare(a.startedAt || ""),
        );
      }
    } catch (err) {
      console.warn("[ee] listEeRuns storage", err);
    }
  }

  ensureRunsRoot();
  const fromIndex = readLocalIndex();
  if (fromIndex.length > 0) {
    return [...fromIndex].sort((a, b) =>
      (b.startedAt || "").localeCompare(a.startedAt || ""),
    );
  }

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
  if (rebuilt.length) writeLocalIndex(rebuilt);
  return rebuilt;
}

export async function getEeRun(runId: string): Promise<EeRunMeta | null> {
  if (!runId || runId.includes("..") || runId.includes("/")) return null;

  if (!preferLocalDiskOnly()) {
    try {
      const remote = await gcsGetJson<EeRunMeta>(
        eeRunObjectPath(runId, "meta.json"),
      );
      if (remote?.id) return remote;
    } catch (err) {
      console.warn("[ee] getEeRun storage", err);
    }
  }

  const metaPath = join(eeRunDir(runId), "meta.json");
  if (!existsSync(metaPath)) {
    const rows = await listEeRuns();
    return rows.find((r) => r.id === runId) ?? null;
  }
  try {
    return JSON.parse(readFileSync(metaPath, "utf8")) as EeRunMeta;
  } catch {
    return null;
  }
}

async function persistIndex(rows: EeRunMeta[]) {
  writeLocalIndex(rows);
  if (preferLocalDiskOnly()) return;
  try {
    await gcsPutJson(eeIndexObjectPath(), rows);
  } catch (err) {
    console.warn("[ee] persistIndex storage", err);
  }
}

export async function createEeRunStub(input: {
  job: EeRunJob;
  triggeredBy?: string | null;
}): Promise<EeRunMeta> {
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
  const body = `${JSON.stringify(meta, null, 2)}\n`;
  writeLocalFile(join(dir, "meta.json"), body);
  if (!preferLocalDiskOnly()) {
    try {
      await gcsPutJson(eeRunObjectPath(id, "meta.json"), meta);
    } catch (err) {
      console.warn("[ee] createEeRunStub storage", err);
    }
  }
  const rows = (await listEeRuns()).filter((r) => r.id !== id);
  rows.unshift(meta);
  await persistIndex(rows);
  return meta;
}

export async function finalizeEeRun(
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
): Promise<EeRunMeta> {
  const prev = await getEeRun(runId);
  if (!prev) {
    throw new Error(`Unknown Earth Engine run: ${runId}`);
  }
  const next: EeRunMeta = {
    ...prev,
    ...patch,
    finishedAt: patch.finishedAt ?? new Date().toISOString(),
  };
  const body = `${JSON.stringify(next, null, 2)}\n`;
  writeLocalFile(join(eeRunDir(runId), "meta.json"), body);
  if (!preferLocalDiskOnly()) {
    try {
      await gcsPutJson(eeRunObjectPath(runId, "meta.json"), next);
    } catch (err) {
      console.warn("[ee] finalizeEeRun storage", err);
    }
  }
  const rows = (await listEeRuns()).map((r) => (r.id === runId ? next : r));
  await persistIndex(rows);
  return next;
}

export async function writeEeRunFile(
  runId: string,
  fileName: string,
  json: unknown,
): Promise<EeRunFileMeta> {
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") {
    throw new Error(`Disallowed file: ${fileName}`);
  }
  const body = `${JSON.stringify(json, null, 2)}\n`;
  const bytes = Buffer.byteLength(body, "utf8");
  writeLocalFile(join(eeRunDir(runId), fileName), body);
  if (!preferLocalDiskOnly()) {
    try {
      await gcsPutJson(eeRunObjectPath(runId, fileName), json);
    } catch (err) {
      console.warn("[ee] writeEeRunFile storage", err);
    }
  }
  return { name: fileName, bytes };
}

export async function readEeRunFile(
  runId: string,
  fileName: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!runId || runId.includes("..") || runId.includes("/")) return null;
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") return null;

  if (!preferLocalDiskOnly()) {
    try {
      const remote = await gcsGetObject(eeRunObjectPath(runId, fileName));
      if (remote) {
        return {
          body: remote.bytes,
          contentType: "application/json; charset=utf-8",
        };
      }
    } catch (err) {
      console.warn("[ee] readEeRunFile storage", err);
    }
  }

  const path = join(eeRunDir(runId), fileName);
  if (!existsSync(path)) return null;
  return {
    body: readFileSync(path),
    contentType: "application/json; charset=utf-8",
  };
}

/** Active EE datasets from Firestore `ee_datasets` (not file cache). */
export async function listActiveEeCacheFiles(): Promise<
  {
    name: string;
    bytes: number;
    mtime: string | null;
    datasetId?: string;
  }[]
> {
  const { listEeDatasets } = await import("@/lib/geo/eeDatasets");
  const rows = await listEeDatasets();
  return rows.map((row) => ({
    name: row.fileName,
    bytes: row.bytes,
    mtime: row.updatedAt,
    datasetId: row.id,
  }));
}

export async function readActiveEeCacheFile(
  fileName: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") return null;
  const { getEeDatasetByFileName } = await import("@/lib/geo/eeDatasets");
  const row = await getEeDatasetByFileName(fileName);
  if (!row?.payload) return null;
  return {
    body: Buffer.from(`${JSON.stringify(row.payload)}\n`, "utf8"),
    contentType: "application/json; charset=utf-8",
  };
}

/** Persist active dataset to Firestore `ee_datasets`. */
export async function writeActiveEeCacheFile(
  fileName: string,
  json: unknown,
): Promise<void> {
  if (!isAllowedEeFileName(fileName) || fileName === "meta.json") {
    throw new Error(`Disallowed file: ${fileName}`);
  }
  const {
    eeDatasetIdFromFileName,
    upsertEeDataset,
  } = await import("@/lib/geo/eeDatasets");
  const id = eeDatasetIdFromFileName(fileName);
  if (!id) throw new Error(`Unknown EE dataset file: ${fileName}`);
  await upsertEeDataset(id, json);
}
