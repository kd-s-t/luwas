"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Support moved to developer console. */
export default function CommandSupportRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/support");
  }, [router]);
  return null;
}
