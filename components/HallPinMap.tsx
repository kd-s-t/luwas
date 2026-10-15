"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  googleMapsApiKey,
  googleMapsMapId,
  hasGoogleMapsApiKey,
} from "@/lib/map/googleMapsConfig";

type Props = {
  center: { lat: number; lng: number };
  zoom: number;
  onChange: (next: {
    center: { lat: number; lng: number };
    zoom: number;
  }) => void;
  className?: string;
};

function MapSync({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const cur = map.getCenter();
    const z = map.getZoom();
    if (!cur || z == null) return;
    if (
      Math.abs(cur.lat() - center.lat) > 1e-5 ||
      Math.abs(cur.lng() - center.lng) > 1e-5 ||
      z !== zoom
    ) {
      map.panTo({ lat: center.lat, lng: center.lng });
      map.setZoom(zoom);
    }
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function PinInteractions({
  center,
  onChange,
}: {
  center: { lat: number; lng: number };
  onChange: Props["onChange"];
}) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    if (!map) return;
    const clickListener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        const ll = e.latLng;
        if (!ll) return;
        onChangeRef.current({
          center: { lat: ll.lat(), lng: ll.lng() },
          zoom: map.getZoom() ?? 14,
        });
      },
    );
    const zoomListener = map.addListener("zoom_changed", () => {
      onChangeRef.current({
        center: { ...centerRef.current },
        zoom: map.getZoom() ?? 14,
      });
    });
    return () => {
      clickListener.remove();
      zoomListener.remove();
    };
  }, [map]);

  return (
    <AdvancedMarker position={{ lat: center.lat, lng: center.lng }}>
      <span
        className="dro-map-marker-dot"
        style={{
          width: 16,
          height: 16,
          background: "var(--accent, #c72929)",
          border: "2px solid #fff",
          borderRadius: 999,
          display: "block",
          boxShadow: "0 1px 4px rgba(31, 33, 38, .35)",
        }}
      />
    </AdvancedMarker>
  );
}

function HallPinMapInner({ center, zoom, onChange, className }: Props) {
  return (
    <div
      className={
        className ??
        "relative h-[280px] w-full overflow-hidden border border-[var(--border)] sm:h-[340px]"
      }
    >
      <Map
        className="h-full w-full"
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={zoom}
        mapId={googleMapsMapId()}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <MapSync center={center} zoom={zoom} />
        <PinInteractions center={center} onChange={onChange} />
      </Map>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] border border-[var(--border)] bg-[var(--surface)]/95 px-2 py-1 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase shadow-sm">
        Click map to place pin
      </p>
    </div>
  );
}

/** Click the map to place the pin. */
export default function HallPinMap(props: Props) {
  if (!hasGoogleMapsApiKey()) {
    return (
      <div
        className={
          props.className ??
          "relative flex h-[280px] w-full items-center justify-center border border-[var(--border)] bg-[var(--surface)] font-mono text-xs text-[var(--muted)] sm:h-[340px]"
        }
      >
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google Maps
      </div>
    );
  }

  return (
    <APIProvider apiKey={googleMapsApiKey()} libraries={["marker"]}>
      <HallPinMapInner {...props} />
    </APIProvider>
  );
}
