"use client";

import Image from "next/image";

/** Neutral flow mark (not a Google brand logo). */
export function FlowMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/brands/lucide.svg"
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export const flowNodeClass =
  "flex flex-col items-center justify-center gap-1 rounded-[8px] border border-[var(--border)] bg-white px-3 py-2.5 text-center";

export const flowLabelClass =
  "w-full text-center text-sm font-medium leading-snug text-[var(--foreground)]";

export const flowMetaClass =
  "w-full text-center font-mono text-[9px] leading-snug text-[var(--muted)]";

/** Cost / price lines shown under the node card. */
export function isFlowCostLine(line: string) {
  return /[$₱]|\/\s*hr|\/\s*SMS|\/\s*\d+\s*min/i.test(line);
}

export function FlowCostsBelow({
  costs,
}: {
  costs: readonly string[] | undefined;
}) {
  if (!costs?.length) return null;
  return (
    <div className="absolute top-full left-1/2 mt-1.5 w-max max-w-[200px] -translate-x-1/2 text-center">
      {costs.map((c) => (
        <p key={c} className={flowMetaClass}>
          {c}
        </p>
      ))}
    </div>
  );
}
