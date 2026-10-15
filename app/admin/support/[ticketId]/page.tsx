"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

/** Support moved to developer console. */
export default function CommandSupportDetailRedirect({ params }: PageProps) {
  const { ticketId: rawId } = use(params);
  const ticketId = decodeURIComponent(rawId);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dev/support/${encodeURIComponent(ticketId)}`);
  }, [router, ticketId]);
  return null;
}
