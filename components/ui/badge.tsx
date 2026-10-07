import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-[var(--on-accent)]",
        outline: "border-[var(--border)] text-[var(--muted)]",
        warn: "border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)]",
        danger:
          "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
