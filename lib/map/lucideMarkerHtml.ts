/** Lucide SVG paths for Leaflet divIcons (HTML strings, no React tree). */

type LucideStrokeIcon = {
  paths: string[];
  viewBox?: string;
};

/** lucide: Tornado */
const TORNADO: LucideStrokeIcon = {
  paths: [
    "M21 4H3",
    "M18 8H6",
    "M19 12H9",
    "M16 16h-6",
    "M11 20H9",
  ],
};

/** lucide: Mountain */
const MOUNTAIN: LucideStrokeIcon = {
  paths: ['m8 3 4 8 5-5 5 15H2L8 3z'],
};

function strokeSvg(
  icon: LucideStrokeIcon,
  opts: { size: number; stroke: string; fill?: string; className?: string },
): string {
  const { size, stroke, fill = "none", className = "" } = opts;
  const paths = icon.paths
    .map(
      (d) =>
        `<path d="${d}" fill="${fill === "none" ? "none" : fill}" stroke="${stroke}"/>`,
    )
    .join("");
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const SLIDE_STROKE: Record<"watch" | "warning" | "critical", string> = {
  watch: "#a67c52",
  warning: "#b8860b",
  critical: "#8b4513",
};

export function lucideTyphoonMarkerHtml(size = 28): string {
  const svg = strokeSvg(TORNADO, {
    size: size - 6,
    stroke: "#1d4ed8",
    className: "dro-map-lucide-typhoon",
  });
  return `<span class="dro-map-lucide-wrap dro-map-lucide-wrap-typhoon">${svg}</span>`;
}

export function lucideLandslideMarkerHtml(
  severity: "watch" | "warning" | "critical",
  size = 22,
): string {
  const stroke = SLIDE_STROKE[severity];
  const svg = strokeSvg(MOUNTAIN, {
    size: size - 4,
    stroke,
    className: `dro-map-lucide-slide dro-map-lucide-slide-${severity}`,
  });
  return `<span class="dro-map-lucide-wrap dro-map-lucide-wrap-slide">${svg}</span>`;
}

export function reportPinMarkerHtml(
  kind: "blockage" | "flood" | "fire" | "warning" | "welfare",
): string {
  const glyph =
    kind === "blockage"
      ? "!"
      : kind === "flood"
        ? "≈"
        : kind === "fire"
          ? "▲"
          : kind === "warning"
            ? "⚠"
            : "?";
  return `<span class="dro-map-marker-report dro-map-marker-report-${kind}">${glyph}</span>`;
}
