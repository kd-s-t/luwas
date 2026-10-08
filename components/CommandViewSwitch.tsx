"use client";

import { cn } from "@/lib/utils";

export type CommandView = "workspace" | "map";

type CommandViewSwitchProps = {
  value: CommandView;
  onChange: (view: CommandView) => void;
  className?: string;
};

export function CommandViewSwitch({
  value,
  onChange,
  className,
}: CommandViewSwitchProps) {
  return (
    <div
      className={cn(
        "inline-flex border border-[var(--border)] bg-[var(--surface-raised)] p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Command view"
    >
      {(
        [
          ["workspace", "Workspace"],
          ["map", "Map"],
        ] as const
      ).map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
              active
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
