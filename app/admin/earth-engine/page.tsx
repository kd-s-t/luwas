"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Earth Engine moved to developer console. */
export default function CommandEarthEngineRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/earth-engine");
  }, [router]);
  return null;
}
