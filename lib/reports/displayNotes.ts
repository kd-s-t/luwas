/** Drop voice lines from notes when the dedicated voice block is shown. */
export function displayReportNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return "";
  return notes
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return (
        !t.startsWith("Voice:") &&
        !t.startsWith("Transcript:") &&
        t !== "Voice note"
      );
    })
    .join("\n")
    .trim();
}

/** Prefer time-only label; strip a duplicated "Voice note ·" prefix. */
export function displayVoiceNoteLabel(
  label: string | null | undefined,
): string | null {
  if (!label?.trim()) return null;
  return label.replace(/^Voice note\s*·\s*/i, "").trim() || null;
}
