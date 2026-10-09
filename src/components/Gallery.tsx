"use client";

import { useEffect, useState } from "react";

const INTERVAL_MS = 6000;

// Wave drawn in a 180 × 1000 box pinned to the gallery's right edge.
// x is in px from the box's left side; y is stretched to the full height.
const WAVE_W = 180;
const WAVE_EDGE =
  "M95,0 C165,80 175,170 110,250 C40,335 15,400 55,490 C95,580 170,640 120,740 C75,830 30,880 70,1000";
const WAVE_FILL = `M${WAVE_W},0 L${WAVE_EDGE.slice(1)} L${WAVE_W},1000 Z`;

// Bubbles breaking away from the wave's deepest curves, drifting into the photo.
// x/y use the wave's coordinate box, r is in px.
type Bubble = { x: number; y: number; r: number; kind: "fill" | "ring" | "dot" };
const BUBBLES: Bubble[] = [
  { x: 74, y: 30, r: 6, kind: "fill" },
  { x: 52, y: 92, r: 4, kind: "ring" },
  { x: 84, y: 285, r: 3, kind: "fill" },

  { x: 26, y: 430, r: 13, kind: "fill" },
  { x: -2, y: 392, r: 9, kind: "fill" },
  { x: -30, y: 365, r: 5, kind: "fill" },
  { x: -48, y: 425, r: 11, kind: "ring" },
  { x: -72, y: 388, r: 3, kind: "fill" },
  { x: -92, y: 410, r: 2, kind: "dot" },

  { x: 30, y: 865, r: 10, kind: "fill" },
  { x: 4, y: 905, r: 6, kind: "fill" },
  { x: -22, y: 852, r: 7, kind: "ring" },
  { x: -44, y: 890, r: 3, kind: "fill" },
  { x: -60, y: 860, r: 2, kind: "dot" },
];

/** Left column: library photos crossfading in a loop, edged by a static wave. */
export default function Gallery({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => setCurrent((i) => (i + 1) % images.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <aside className="gallery" aria-hidden="true">
      {images.map((src, i) => (
        <div
          key={src}
          className={`slide${i === current ? " is-active" : ""}`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}

      {images.length === 0 && (
        <p className="gallery-empty">
          Add photos to <code>public/gallery/</code>
        </p>
      )}

      <svg className="wave" viewBox={`0 0 ${WAVE_W} 1000`} preserveAspectRatio="none" style={{ width: WAVE_W }}>
        <path className="wave-fill" d={WAVE_FILL} />
        <path className="wave-line" d={WAVE_EDGE} transform="translate(-14 0)" vectorEffect="non-scaling-stroke" />
      </svg>

      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className={`bubble bubble-${b.kind}`}
          style={{
            width: b.r * 2,
            height: b.r * 2,
            right: WAVE_W - b.x - b.r,
            top: `calc(${b.y / 10}% - ${b.r}px)`,
          }}
        />
      ))}
    </aside>
  );
}
