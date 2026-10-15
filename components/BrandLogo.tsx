import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  /** Mark size in px (height). */
  size?: number;
  /** Show LUWAS wordmark beside the mark. */
  wordmark?: boolean;
  /** `default` = brand red. `inverse` = white (dark / accent bars). */
  tone?: "default" | "inverse";
  wordmarkClassName?: string;
};

const SHIELD =
  "M236 65h40c8 0 16 3 22 9l122 122c7 7 11 16 11 26v128c0 50-27 95-71 126l-80 53c-12 8-28 8-40 0l-80-53c-44-31-71-76-71-126V222c0-10 4-19 11-26L214 74c6-6 14-9 22-9z";
const CHEVRONS = [
  "M146 250 256 160l110 90-38 38L256 218l-72 60z",
  "M146 310 256 220l110 90-38 38L256 278l-72 60z",
  "M146 370 256 280l110 90-38 38L256 338l-72 60z",
];
const MARK_EVENODD = `${SHIELD}${CHEVRONS.map((d) => ` ${d}`).join("")}`;

/** Shield + chevrons. Brand red is hardcoded so local never inherits gray. */
export function BrandMark({
  className,
  size = 28,
  tone = "default",
}: {
  className?: string;
  size?: number;
  tone?: "default" | "inverse";
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {tone === "inverse" ? (
        <path fill="#ffffff" fillRule="evenodd" d={MARK_EVENODD} />
      ) : (
        <>
          <path fill="#c72929" d={SHIELD} />
          {CHEVRONS.map((d) => (
            <path key={d} fill="#ffffff" d={d} />
          ))}
        </>
      )}
    </svg>
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
            tone === "inverse" ? "text-white" : "text-[var(--foreground)]",
            wordmarkClassName,
          )}
        >
          LUWAS
        </span>
      ) : null}
    </span>
  );
}
