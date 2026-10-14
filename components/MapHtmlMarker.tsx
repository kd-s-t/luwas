"use client";

import { useState, type ReactNode } from "react";
import {
  AdvancedMarker,
  InfoWindow,
  AdvancedMarkerAnchorPoint,
} from "@vis.gl/react-google-maps";

type MapHtmlMarkerProps = {
  position: { lat: number; lng: number };
  html: string;
  zIndex?: number;
  /** Popup body when the marker is clicked. */
  children?: ReactNode;
  title?: string;
  anchorPoint?: (typeof AdvancedMarkerAnchorPoint)[keyof typeof AdvancedMarkerAnchorPoint];
};

/** Custom HTML pin via Advanced Marker + optional InfoWindow. */
export function MapHtmlMarker({
  position,
  html,
  zIndex,
  children,
  title,
  anchorPoint = AdvancedMarkerAnchorPoint.CENTER,
}: MapHtmlMarkerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        position={position}
        zIndex={zIndex}
        title={title}
        anchorPoint={anchorPoint}
        onClick={() => {
          if (children) setOpen(true);
        }}
      >
        <div
          className="dro-map-marker"
          // Marker HTML is built by our lucide/facility helpers (trusted).
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </AdvancedMarker>
      {open && children ? (
        <InfoWindow
          position={position}
          onCloseClick={() => setOpen(false)}
          headerDisabled
        >
          <div className="dro-gmap-popup">{children}</div>
        </InfoWindow>
      ) : null}
    </>
  );
}
