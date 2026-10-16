import { cn } from "@/lib/utils";

type BrandTone = "default" | "inverse" | "blue";

type BrandLogoProps = {
  className?: string;
  /** Mark size in px (height). */
  size?: number;
  /** Show UGNAI wordmark beside the mark. */
  wordmark?: boolean;
  /** `default` = ink wordmark. `inverse` = white. `blue` = admin. */
  tone?: BrandTone;
  wordmarkClassName?: string;
};

const LOGO_SRC = "/brand/ugnai-logo.jpg";

/** Official UGNAI mark from `public/brand/ugnai-logo.jpg`. */
export function BrandMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
  tone?: BrandTone;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand mark from single jpg asset
    <img
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden
    />
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
            wordmarkClassName,
          )}
        >
          UGNAI
        </span>
      ) : null}
    </span>
  );
}

/** Mark + light wordmark for dark admin / developer chrome. */
export function BrandLogoOnDark({
  className,
  size = 28,
  wordmark = true,
  wordmarkClassName,
}: Omit<BrandLogoProps, "tone">) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} />
      {wordmark ? (
        <span
          className={cn(
            "font-[family-name:var(--font-display)] font-semibold tracking-[0.08em] text-white",
            wordmarkClassName,
          )}
        >
          UGNAI
        </span>
      ) : null}
    </span>
  );
}
