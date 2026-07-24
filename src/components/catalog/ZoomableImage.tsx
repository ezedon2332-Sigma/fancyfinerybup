"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";

/** HD product image with cursor-follow hover zoom (desktop) and a full-screen
 *  pinch-to-zoom lightbox (mobile + desktop) for inspecting fine detail. */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [lightbox, setLightbox] = useState(false);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMove}
        onClick={() => setLightbox(true)}
        className="group relative h-full w-full cursor-zoom-in overflow-hidden"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover transition-transform duration-300 ease-out"
          style={{
            transform: zoom ? "scale(2.4)" : "scale(1)",
            transformOrigin: origin,
          }}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </span>
      </div>

      {lightbox && (
        <ZoomLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />
      )}
    </>
  );
}

function ZoomLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="h-full w-full overflow-auto p-4"
        style={{ touchAction: "pinch-zoom" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto aspect-[3/4] w-full max-w-3xl">
          <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" />
        </div>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-white/60">
        Pinch to zoom · tap outside to close
      </p>
    </div>
  );
}
