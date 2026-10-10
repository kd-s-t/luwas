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

/** lucide: Flame — BFP fire station */
const FLAME: LucideStrokeIcon = {
  paths: [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
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
): string {
  const stroke =
    kind === "hall"
      ? "#9e1a1a"
      : kind === "school"
        ? "#1d4ed8"
        : kind === "evac_center"
          ? "#2e8c57"
          : kind === "bfp"
            ? "#ea580c"
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
          : kind === "bfp"
            ? FLAME
            : kind === "hospital"
              ? CROSS
              : LANDMARK;
  const svg = strokeSvg(icon, {
    size: size - 8,
    stroke,
    className: `dro-map-lucide-facility dro-map-lucide-facility-${kind}`,
  });
  return `<span class="dro-map-lucide-wrap dro-map-lucide-wrap-facility dro-map-lucide-wrap-facility-${kind}">${svg}</span>`;
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
