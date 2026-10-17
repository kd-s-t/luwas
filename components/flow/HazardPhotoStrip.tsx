"use client";

import Image from "next/image";

const PHOTOS = [
  { src: "/reports/flow-hazards/flood-1.png", label: "flood" },
  { src: "/reports/flow-hazards/flood-2.png", label: "flood" },
  { src: "/reports/flow-hazards/fire-1.png", label: "fire" },
  { src: "/reports/flow-hazards/fire-2.png", label: "fire" },
  { src: "/reports/flow-hazards/collapsed-1.png", label: "collapsed" },
  { src: "/reports/flow-hazards/landslide-1.png", label: "landslide" },
] as const;

/** Six hazard thumbs shown above Investigate the location. */
export function HazardPhotoStrip() {
  return (
    <div className="absolute bottom-full left-1/2 mb-2 grid w-max -translate-x-1/2 grid-cols-2 gap-1">
      {PHOTOS.map((p) => (
        <div
          key={p.src}
          className="relative size-11 overflow-hidden rounded-[4px] border border-[var(--border)] bg-white"
          title={p.label}
        >
          <Image
            src={p.src}
            alt={p.label}
            width={44}
            height={44}
            className="size-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
