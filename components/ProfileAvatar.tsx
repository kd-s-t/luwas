"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Deterministic portrait URL when the user has no uploaded photo. */
export function avatarPhotoSrc(seed: string): string {
  const key = seed.trim() || "luwas";
  return `https://i.pravatar.cc/128?u=${encodeURIComponent(key)}`;
}

type ProfileAvatarProps = {
  name: string;
  photoURL?: string | null;
  /** Stable id/email for fallback portrait when photoURL is missing. */
  seed?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
} as const;

export function ProfileAvatar({
  name,
  photoURL,
  seed,
  size = "md",
  className,
}: ProfileAvatarProps) {
  const hue = hashHue(name || seed || "user");
  const src = photoURL?.trim() || avatarPhotoSrc(seed || name || "user");
  const [failed, setFailed] = useState(false);

  if (!failed && src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]",
          SIZES[size],
          className,
        )}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ring-1 ring-black/5",
        SIZES[size],
        className,
      )}
      style={{
        background: `hsl(${hue} 42% 38%)`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
