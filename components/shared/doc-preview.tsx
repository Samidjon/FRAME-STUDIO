"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignDocument } from "@/types/project";
import { renderPreviewUrl } from "@/lib/image/thumbnail";
import { cx } from "./ui";

/**
 * Renders a live DesignDocument to an <img> using the shared renderer, lazily
 * when scrolled into view. `cacheKey` must change when the document changes.
 */
export function DocPreview({
  doc,
  cacheKey,
  maxSide = 520,
  className,
  alt = "",
  fit = "contain",
}: {
  doc: DesignDocument;
  cacheKey: string;
  maxSide?: number;
  className?: string;
  alt?: string;
  fit?: "contain" | "cover";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setError(false);
    renderPreviewUrl(`${cacheKey}@${maxSide}`, doc, maxSide)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [visible, cacheKey, doc, maxSide]);

  return (
    <div ref={ref} className={cx("relative overflow-hidden", className)} style={{ aspectRatio: `${doc.width} / ${doc.height}` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className={cx("absolute inset-0 h-full w-full animate-fade", fit === "cover" ? "object-cover" : "object-contain")} draggable={false} />
      ) : (
        <div className={cx("absolute inset-0", error ? "bg-sunken" : "animate-pulse bg-sunken")} aria-hidden>
          {error && <span className="label-mono absolute bottom-2 left-2">Preview unavailable</span>}
        </div>
      )}
    </div>
  );
}
