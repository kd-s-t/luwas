"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Roles moved to developer console. */
export default function CommandRolesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/roles");
  }, [router]);
  return null;
}
