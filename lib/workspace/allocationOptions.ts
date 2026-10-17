import type {
  DeliveryReadiness,
  SupplyCommunityRow,
} from "@/lib/workspace/supplyShortagePlan";

export type AllocationConstraint =
  | "no_blockers"
  | "access_unverified"
  | "no_transport";

export type AllocationLine = {
  community: string;
  reportId: string;
  needL: number;
  allocateL: number;
  readiness: DeliveryReadiness;
  constraint: AllocationConstraint;
  constraintLabel: string;
};

export type AllocationOption = {
  id: string;
  title: string;
  blurb: string;
  suggested?: boolean;
  lines: AllocationLine[];
  summary: string;
};

export type AllocationOptionsResult = {
  availableL: number;
  totalNeededL: number;
  shortageL: number;
  resourceLabel: string;
  options: AllocationOption[];
  source: "gemini" | "local";
};

function constraintFor(
  readiness: DeliveryReadiness,
): { constraint: AllocationConstraint; constraintLabel: string } {
  if (readiness === "ready") {
    return { constraint: "no_blockers", constraintLabel: "No blockers" };
  }
  if (readiness === "no_transport") {
    return { constraint: "no_transport", constraintLabel: "No transport" };
  }
  return {
    constraint: "access_unverified",
    constraintLabel: "Access unverified",
  };
}

function lineBase(row: SupplyCommunityRow): Omit<AllocationLine, "allocateL"> {
  const c = constraintFor(row.readiness);
  return {
    community: row.community,
    reportId: row.reportId,
    needL: row.gapL > 0 ? row.gapL : row.needL,
    readiness: row.readiness,
    ...c,
  };
}

function roundL(n: number): number {
  return Math.max(0, Math.round(n / 10) * 10);
}

/** Deterministic fallback when Gemini is offline. */
export function buildLocalAllocationOptions(
  rows: SupplyCommunityRow[],
  availableL: number,
  totalNeededL: number,
  resourceLabel: string,
): AllocationOptionsResult {
  const sorted = [...rows].sort((a, b) => b.gapL - a.gapL || b.needL - a.needL);
  const bases = sorted.map(lineBase);
  const pool = Math.max(0, availableL);

  // Option 1: skip no_transport; split warehouse across ready + access_unknown
  // (ready weighted higher), matching the design “feasible deliveries” card.
  const orderIds = bases.map((b) => b.reportId);
  const moveable = bases.filter((b) => b.readiness !== "no_transport");
  const weight = (b: (typeof bases)[number]) =>
    b.needL * (b.readiness === "ready" ? 1.4 : 1);
  const weightSum = moveable.reduce((s, b) => s + weight(b), 0) || 1;
  let feasibleLeft = pool;
  const feasibleAlloc = new Map<string, number>();
  moveable.forEach((b, i) => {
    const isLast = i === moveable.length - 1;
    const share = isLast
      ? feasibleLeft
      : Math.min(b.needL, roundL((weight(b) / weightSum) * pool), feasibleLeft);
    const take = Math.min(b.needL, Math.max(0, share));
    feasibleAlloc.set(b.reportId, take);
    feasibleLeft -= take;
  });
  if (feasibleLeft > 0) {
    for (const b of moveable) {
      if (feasibleLeft <= 0) break;
      const cur = feasibleAlloc.get(b.reportId) ?? 0;
      const room = b.needL - cur;
      if (room <= 0) continue;
      const add = Math.min(room, feasibleLeft);
      feasibleAlloc.set(b.reportId, cur + add);
      feasibleLeft -= add;
    }
  }
  const opt1Lines: AllocationLine[] = bases.map((b) => ({
    ...b,
    allocateL:
      b.readiness === "no_transport"
        ? 0
        : feasibleAlloc.get(b.reportId) ?? 0,
  }));
  opt1Lines.sort(
    (a, b) => orderIds.indexOf(a.reportId) - orderIds.indexOf(b.reportId),
  );

  // Option 2: share evenly (cap at need)
  const n = Math.max(1, bases.length);
  let evenLeft = pool;
  const evenShare = roundL(pool / n);
  const opt2Lines: AllocationLine[] = bases.map((b, i) => {
    const isLast = i === bases.length - 1;
    const raw = isLast ? evenLeft : Math.min(evenShare, evenLeft, b.needL);
    const take = Math.min(b.needL, Math.max(0, raw));
    evenLeft -= take;
    return { ...b, allocateL: take };
  });
  if (evenLeft > 0) {
    for (const line of opt2Lines) {
      if (evenLeft <= 0) break;
      const room = line.needL - line.allocateL;
      if (room <= 0) continue;
      const add = Math.min(room, evenLeft);
      line.allocateL += add;
      evenLeft -= add;
    }
  }

  // Option 3: prioritize highest need (proportional to need)
  const needSum = bases.reduce((s, b) => s + b.needL, 0) || 1;
  let propLeft = pool;
  const opt3Lines: AllocationLine[] = bases.map((b, i) => {
    const isLast = i === bases.length - 1;
    const share = isLast
      ? propLeft
      : roundL((b.needL / needSum) * pool);
    const take = Math.min(b.needL, Math.max(0, share), propLeft);
    propLeft -= take;
    return { ...b, allocateL: take };
  });
  if (propLeft > 0) {
    for (const line of opt3Lines) {
      if (propLeft <= 0) break;
      const room = line.needL - line.allocateL;
      if (room <= 0) continue;
      const add = Math.min(room, propLeft);
      line.allocateL += add;
      propLeft -= add;
    }
  }

  const blockedNote = (lines: AllocationLine[]) => {
    const blocked = lines.filter((l) => l.allocateL > 0 && l.readiness !== "ready");
    const zeroed = lines.filter((l) => l.allocateL === 0);
    const parts: string[] = [];
    if (blocked.length) {
      parts.push(
        blocked
          .map(
            (l) =>
              `${l.community}'s ${l.allocateL.toLocaleString("en-PH")} L is conditional on ${l.constraintLabel.toLowerCase()}.`,
          )
          .join(" "),
      );
    }
    if (zeroed.length) {
      parts.push(
        zeroed
          .map((l) => `${l.community} remains pending (${l.constraintLabel.toLowerCase()}).`)
          .join(" "),
      );
    }
    return parts.join(" ");
  };

  return {
    availableL: pool,
    totalNeededL,
    shortageL: Math.max(0, totalNeededL - pool),
    resourceLabel,
    source: "local",
    options: [
      {
        id: "feasible",
        title: "Focus on feasible deliveries",
        blurb: "Prioritize communities with no delivery blockers.",
        suggested: true,
        lines: opt1Lines,
        summary: `Focus on what can move now. ${blockedNote(opt1Lines)}`.trim(),
      },
      {
        id: "even",
        title: "Share evenly across communities",
        blurb: "Distribute available supply equally regardless of blockers.",
        lines: opt2Lines,
        summary: `Provides a balanced distribution. ${blockedNote(opt2Lines)}`.trim(),
      },
      {
        id: "need",
        title: "Prioritize highest need",
        blurb: "Allocate more to the community with the greatest demand.",
        lines: opt3Lines,
        summary: `Focuses on the largest need. ${blockedNote(opt3Lines)}`.trim(),
      },
    ],
  };
}

export function normalizeAllocationOptions(
  raw: unknown,
  rows: SupplyCommunityRow[],
  availableL: number,
  totalNeededL: number,
  resourceLabel: string,
): AllocationOptionsResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { options?: unknown };
  if (!Array.isArray(obj.options) || obj.options.length < 3) return null;

  const options: AllocationOption[] = [];
  for (let i = 0; i < 3; i++) {
    const o = obj.options[i] as Record<string, unknown> | undefined;
    if (!o) return null;
    const linesRaw = Array.isArray(o.lines) ? o.lines : [];
    const lines: AllocationLine[] = [];
    for (const row of rows) {
      const hit =
        linesRaw.find((l) => {
          if (!l || typeof l !== "object") return false;
          const lr = l as Record<string, unknown>;
          const id = String(lr.reportId ?? "");
          const name = String(lr.community ?? "").trim().toLowerCase();
          return id === row.reportId || name === row.community.toLowerCase();
        }) ?? null;
      const base = lineBase(row);
      const allocateL = hit
        ? Math.max(
            0,
            Math.min(
              base.needL,
              Number((hit as { allocateL?: number }).allocateL) || 0,
            ),
          )
        : 0;
      lines.push({ ...base, allocateL });
    }
    // Ensure pool is not wildly over-allocated
    const sum = lines.reduce((s, l) => s + l.allocateL, 0);
    if (sum > availableL && sum > 0) {
      const scale = availableL / sum;
      for (const line of lines) {
        line.allocateL = roundL(line.allocateL * scale);
      }
    }
    options.push({
      id: String(o.id ?? `option-${i + 1}`),
      title: String(o.title ?? `Option ${i + 1}`),
      blurb: String(o.blurb ?? ""),
      suggested: i === 0,
      lines,
      summary: String(o.summary ?? ""),
    });
  }

  return {
    availableL,
    totalNeededL,
    shortageL: Math.max(0, totalNeededL - availableL),
    resourceLabel,
    source: "gemini",
    options,
  };
}
