/** Holds a file chosen before navigating to the report form (same-tap camera). */
let pending: File | null = null;

export function setPendingReportMedia(file: File): void {
  pending = file;
}

export function takePendingReportMedia(): File | null {
  const next = pending;
  pending = null;
  return next;
}
