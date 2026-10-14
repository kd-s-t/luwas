"use client";

import {
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";

type MapProps = ComponentProps<
  typeof import("@/components/CommandAreaMap").default
>;

/**
 * Client-only map mount. Imports the Google Maps command map only after mount,
 * and uses webpackMode eager so shared lib/* factories live in this client
 * graph instead of a broken async split chunk (`undefined.call` in webpack).
 */
export function CommandAreaMapMount(props: MapProps) {
  const [Map, setMap] = useState<ComponentType<MapProps> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import(
      /* webpackMode: "eager" */
      "@/components/CommandAreaMap"
    )
      .then((mod) => {
        if (!cancelled) setMap(() => mod.default);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Map failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center bg-[var(--surface)] px-4 text-center font-mono text-xs text-[var(--danger)]">
        Map error · {error}
      </div>
    );
  }

  if (!Map) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center bg-[var(--surface)] font-mono text-xs text-[var(--muted)]">
        Loading map…
      </div>
    );
  }

  return <Map {...props} />;
}
