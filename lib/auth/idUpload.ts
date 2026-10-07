import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getClientStorage } from "@/lib/firebase/client";

export async function uploadIdentityMedia(input: {
  uid: string;
  kind: "id" | "face";
  file: File;
}): Promise<{ path: string; url: string }> {
  const safe = input.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 60);
  const path = `identity/${input.uid}/${input.kind}-${Date.now()}-${safe}`;
  const storageRef = ref(getClientStorage(), path);
  await uploadBytes(storageRef, input.file, {
    contentType: input.file.type || "image/jpeg",
  });
  const url = await getDownloadURL(storageRef);
  return { path, url };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
