import { compressReportImage } from "@/lib/reports/upload";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 4;

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name)
  );
}

/** Upload an inventory item photo via same-origin API (Admin GCS). */
export async function uploadInventoryPhoto(input: {
  uid: string;
  barangayId: string;
  file: File;
}): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string }> {
  if (input.file.size > MAX_BYTES) {
    throw new Error("Photo must be under 12 MB.");
  }
  if (!isImageFile(input.file)) {
    throw new Error("Images only.");
  }

  const file = await compressReportImage(input.file);
  const body = new FormData();
  body.set("uid", input.uid.trim() || "officer");
  body.set("barangayId", input.barangayId.trim() || "barangay");
  body.set("file", file, file.name || "item.jpg");

  const res = await fetch("/api/inventory/upload", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    mediaPath?: string;
    mediaUrl?: string;
    mediaMime?: string;
  };
  if (!res.ok || !data.mediaUrl || !data.mediaPath) {
    throw new Error(data.error || "Photo upload failed");
  }

  return {
    mediaPath: data.mediaPath,
    mediaUrl: data.mediaUrl,
    mediaMime: data.mediaMime || file.type || "image/jpeg",
  };
}

export function inventoryPhotoLimit(): number {
  return MAX_PHOTOS;
}

export function isInventoryPhotoFile(file: File): boolean {
  return isImageFile(file);
}
