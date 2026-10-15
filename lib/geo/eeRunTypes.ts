export type EeRunJob = "dem" | "hazards" | "both";

export type EeRunStatus = "running" | "ok" | "failed";

export type EeRunFileMeta = {
  name: string;
  bytes: number;
};

export type EeRunMeta = {
  id: string;
  job: EeRunJob;
  status: EeRunStatus;
  startedAt: string;
  finishedAt: string | null;
  projectId: string | null;
  provider: string | null;
  error: string | null;
  triggeredBy: string | null;
  files: EeRunFileMeta[];
  counts?: Record<string, number>;
};
