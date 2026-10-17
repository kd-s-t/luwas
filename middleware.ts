import { NextRequest, NextResponse } from "next/server";

/** Retired brand domain — keep serving 410 while DNS still hits Hosting. */
const RETIRED_HOSTS = new Set(["luwasph.com", "www.luwasph.com"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  if (RETIRED_HOSTS.has(host)) {
    return new NextResponse("Gone. Use https://ugnaiph.com", {
      status: 410,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
