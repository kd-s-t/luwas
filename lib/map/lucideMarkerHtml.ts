/** Lucide SVG paths for Google Maps Advanced Marker HTML (no React tree). */

type LucideStrokeIcon = {
  paths: string[];
  viewBox?: string;
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
        `<path d="${d}" fill="${fill === "none" ? "none" : fill}" stroke="${stroke}" style="stroke:${stroke} !important;fill:${fill === "none" ? "none" : fill}"/>`,
    )
    .join("");
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" style="stroke:${stroke} !important" aria-hidden="true">${paths}</svg>`;
}

const SLIDE_STROKE: Record<"watch" | "warning" | "critical", string> = {
  watch: "#a67c52",
  warning: "#b8860b",
  critical: "#8b4513",
};

/** Red spiral PNG — no chip bg; spins clockwise (see `.dro-map-tornado-spin`). */
export function lucideTyphoonMarkerHtml(size = 28): string {
  const px = Math.max(18, Math.min(32, size));
  return `<span class="dro-map-tornado-pin" style="display:block;width:${px}px;height:${px}px;background:transparent;border:none;box-shadow:none;overflow:visible"><span class="dro-map-tornado-spin" aria-hidden="true"><img src="/map/tornado.png?v=4" alt="Typhoon" width="${px}" height="${px}" draggable="false" style="display:block;width:${px}px;height:${px}px;background:transparent" /></span></span>`;
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

/** lucide: Building2 — barangay hall / command */
const BUILDING: LucideStrokeIcon = {
  paths: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4",
  ],
};

/** lucide: GraduationCap — school (clearer than School at pin size) */
const SCHOOL: LucideStrokeIcon = {
  paths: [
    "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
    "M22 10v6",
    "M6 12.5V16a6 3 0 0 0 12 0v-3.5",
  ],
};

/** lucide: House — designated evacuation center */
const HOUSE: LucideStrokeIcon = {
  paths: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
};

/** lucide: MapPin — generic landmark */
const LANDMARK: LucideStrokeIcon = {
  paths: [
    "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
    "M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
};

/** lucide: Cross — hospital / health */
const CROSS: LucideStrokeIcon = {
  paths: [
    "M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z",
  ],
};

export type FacilityMarkerKind =
  | "hall"
  | "school"
  | "evac_center"
  | "landmark"
  | "bfp"
  | "hospital";

/** Distinct map pins: hall, school, EC, landmark, BFP, hospital. */
export function facilityMarkerHtml(
  kind: FacilityMarkerKind,
  size = 26,
  opts?: {
    /** Flooded / inundated — amber warning, never life-green. */
    flooded?: boolean;
  },
): string {
  const flooded = Boolean(opts?.flooded);
  const wrapClass = `dro-map-lucide-wrap dro-map-lucide-wrap-facility dro-map-lucide-wrap-facility-${kind}${
    flooded ? " dro-map-lucide-wrap-facility-flooded" : ""
  }`;
  // Inline styles + hard-coded SVG stroke — CSS HMR used to leave ECs #2e8c57 green on water.
  const wrapStyle = flooded
    ? ' style="color:#c2410c;border-color:#c2410c;background:#ffedd5;width:28px;height:28px"'
    : kind === "evac_center"
      ? ' style="color:#57534e;border-color:#57534e;background:#fafaf9;width:28px;height:28px"'
      : ' style="width:28px;height:28px"';

  // BFP: firefighter helmet PNG — transparent (no black chip). Version query busts marker HTML cache.
  if (kind === "bfp") {
    const px = 28;
    const bfpStyle =
      ' style="width:28px;height:28px;padding:0;margin:0;overflow:visible;background:transparent;border:none;box-shadow:none"';
    return `<span class="dro-map-bfp-pin dro-map-lucide-wrap-facility-bfp-img"${bfpStyle}><img src="/map/bfp-helmet.png?v=5" alt="BFP" width="${px}" height="${px}" class="dro-map-bfp-helmet" draggable="false" style="display:block;width:28px;height:28px;object-fit:contain;background:transparent" /></span>`;
  }

  // Evac houses: slate dry / orange flooded. Never life-green (#2e8c57).
  const stroke = flooded
    ? "#c2410c"
    : kind === "hall"
      ? "#9e1a1a"
      : kind === "school"
        ? "#1d4ed8"
        : kind === "evac_center"
          ? "#78716c"
          : kind === "hospital"
            ? "#be123c"
            : "#78716c";
  const icon =
    kind === "hall"
      ? BUILDING
      : kind === "school"
        ? SCHOOL
        : kind === "evac_center"
          ? HOUSE
          : kind === "hospital"
            ? CROSS
            : LANDMARK;
  const svg = strokeSvg(icon, {
    size: size - 8,
    stroke,
    // Soft fill when flooded so the glyph cannot read as "safe green".
    fill: flooded && kind === "evac_center" ? "#fdba74" : "none",
    className: `dro-map-lucide-facility dro-map-lucide-facility-${kind}${
      flooded ? " dro-map-lucide-facility-flooded" : ""
    }`,
  });
  return `<span class="${wrapClass}" data-flooded="${flooded ? "1" : "0"}"${wrapStyle}>${svg}</span>`;
}

export function reportPinMarkerHtml(
  kind:
    | "blockage"
    | "flood"
    | "fire"
    | "landslide"
    | "warning"
    | "welfare"
    | "evac_status",
): string {
  const glyph =
    kind === "blockage"
      ? "!"
      : kind === "flood"
        ? "≈"
        : kind === "fire"
          ? "▲"
          : kind === "landslide"
            ? "▲"
            : kind === "warning"
              ? "⚠"
              : kind === "evac_status"
                ? "◎"
                : "?";
  return `<span class="dro-map-marker-report dro-map-marker-report-${kind}">${glyph}</span>`;
}
