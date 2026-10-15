import { cn } from "@/lib/utils";

type BrandTone = "default" | "inverse" | "blue";

type BrandLogoProps = {
  className?: string;
  /** Mark size in px (height). */
  size?: number;
  /** Show LUWAS wordmark beside the mark. */
  wordmark?: boolean;
  /** `default` = brand red. `inverse` = white. `blue` = admin / developer. */
  tone?: BrandTone;
  wordmarkClassName?: string;
};

const BLUE = "#1d4ed8";
const BLUE_ON_DARK = "#60a5fa";

const SHIELD =
  "M236 65h40c8 0 16 3 22 9l122 122c7 7 11 16 11 26v128c0 50-27 95-71 126l-80 53c-12 8-28 8-40 0l-80-53c-44-31-71-76-71-126V222c0-10 4-19 11-26L214 74c6-6 14-9 22-9z";
const CHEVRONS = [
  "M146 250 256 160l110 90-38 38L256 218l-72 60z",
  "M146 310 256 220l110 90-38 38L256 278l-72 60z",
  "M146 370 256 280l110 90-38 38L256 338l-72 60z",
];
const MARK_EVENODD = `${SHIELD}${CHEVRONS.map((d) => ` ${d}`).join("")}`;

const isLocal = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

function LocalGrayOverlay() {
  if (!isLocal) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[3px] bg-neutral-500/50 mix-blend-saturation"
    />
  );
}

/** Shield + chevrons. Local (emulators) gets a gray overlay. */
export function BrandMark({
  className,
  size = 28,
  tone = "default",
}: {
  className?: string;
  size?: number;
  tone?: BrandTone;
}) {
  const fill =
    tone === "inverse"
      ? "#ffffff"
      : tone === "blue"
        ? BLUE
        : "#c72929";

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className={cn("shrink-0", isLocal && "grayscale")}
        aria-hidden
      >
        {tone === "inverse" ? (
          <path fill={fill} fillRule="evenodd" d={MARK_EVENODD} />
        ) : (
          <>
            <path fill={fill} d={SHIELD} />
            {CHEVRONS.map((d) => (
              <path key={d} fill="#ffffff" d={d} />
            ))}
          </>
        )}
      </svg>
      <LocalGrayOverlay />
    </span>
  );
}

export function BrandLogo({
  className,
  size = 28,
  wordmark = true,
  tone = "default",
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} tone={tone} />
      {wordmark ? (
        <span
          className={cn(
            "font-[family-name:var(--font-display)] font-semibold tracking-[0.08em]",
            tone === "inverse"
              ? "text-white"
              : tone === "blue"
                ? "text-[#1d4ed8]"
                : "text-[var(--foreground)]",
            isLocal && "text-neutral-500",
            wordmarkClassName,
          )}
        >
          LUWAS
        </span>
      ) : null}
    </span>
  );
}

/** Blue mark + light wordmark for dark admin / developer chrome. */
export function BrandLogoOnDark({
  className,
  size = 28,
  wordmark = true,
  wordmarkClassName,
}: Omit<BrandLogoProps, "tone">) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="relative inline-flex shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width={size}
          height={size}
          className={cn("shrink-0", isLocal && "grayscale")}
          aria-hidden
        >
          <path fill={BLUE_ON_DARK} d={SHIELD} />
          {CHEVRONS.map((d) => (
            <path key={d} fill="#0f1b2d" d={d} />
          ))}
        </svg>
        <LocalGrayOverlay />
      </span>
      {wordmark ? (
        <span
          className={cn(
            "font-[family-name:var(--font-display)] font-semibold tracking-[0.08em] text-white",
            isLocal && "text-neutral-400",
            wordmarkClassName,
          )}
        >
          LUWAS
        </span>
      ) : null}
    </span>
  );
}
