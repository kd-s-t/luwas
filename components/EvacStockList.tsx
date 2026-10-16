"use client";

import {
  BedDouble,
  Droplets,
  Package,
  Pill,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  evacStockItems,
  type EvacCenterStock,
  type EvacStockLineKind,
} from "@/lib/evacCenters/types";
import { cn } from "@/lib/utils";

const STOCK_ICON: Record<EvacStockLineKind, LucideIcon> = {
  food: Package,
  water: Droplets,
  blankets: BedDouble,
  medical: Pill,
  other: Package,
};

type EvacStockListProps = {
  stock: EvacCenterStock;
  occupancy?: number;
  capacity?: number;
  className?: string;
};

export function EvacStockList({
  stock,
  occupancy,
  capacity,
  className,
}: EvacStockListProps) {
  const items = evacStockItems(stock);
  const showPeople =
    typeof occupancy === "number" && typeof capacity === "number";

  if (!showPeople && items.length === 0) {
    return (
      <p className={cn("text-sm text-[var(--muted)]", className)}>
        No stock recorded
      </p>
    );
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {showPeople ? (
        <li className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
          <Users
            className="size-4 shrink-0 text-[var(--muted)]"
            strokeWidth={2}
            aria-hidden
          />
          <span>
            {occupancy} / {capacity} people
          </span>
        </li>
      ) : null}
      {items.map((item) => {
        const Icon = STOCK_ICON[item.kind];
        return (
          <li
            key={`${item.kind}-${item.label}`}
            className="flex items-center gap-2.5 text-sm text-[var(--foreground)]"
          >
            <Icon
              className="size-4 shrink-0 text-[var(--muted)]"
              strokeWidth={2}
              aria-hidden
            />
            <span>{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
