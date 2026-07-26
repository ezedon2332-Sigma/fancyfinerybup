/** Original Fancy Finery hero emblem: a faceted finial above a double-lined
 *  couture crest carrying the FF monogram, with hairline wings either side.
 *  Pure SVG so it stays crisp at any size and inherits the site's gold ramp.
 *  Decorative — the adjacent <h1> carries the brand name for assistive tech. */
export function BrandEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 190"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Vertical metal ramp — same stops as the brand wordmark. */}
        <linearGradient id="ff-emblem-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff4d1" />
          <stop offset="22%" stopColor="#fde68a" />
          <stop offset="48%" stopColor="#f0c245" />
          <stop offset="68%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a9791b" />
        </linearGradient>
        {/* Hairline wings fade out towards the edges. */}
        <linearGradient id="ff-emblem-fade-l" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#eab308" stopOpacity="0" />
          <stop offset="100%" stopColor="#f0c245" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ff-emblem-fade-r" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f0c245" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Faceted finial */}
      <g fill="none" stroke="url(#ff-emblem-gold)" strokeWidth="1.6">
        <path d="M80 3 L92.5 17 L80 31 L67.5 17 Z" />
        <path d="M80 3 L80 31 M67.5 17 L92.5 17" strokeWidth="0.7" opacity="0.7" />
      </g>

      {/* Crest — outer and inner rule */}
      <path
        d="M80 38 C110 38 127 55 127 82 C127 121 106 152 80 176 C54 152 33 121 33 82 C33 55 50 38 80 38 Z"
        fill="none"
        stroke="url(#ff-emblem-gold)"
        strokeWidth="2.1"
      />
      <path
        d="M80 47 C104 47 118 61 118 83 C118 117 100 144 80 165 C60 144 42 117 42 83 C42 61 56 47 80 47 Z"
        fill="none"
        stroke="url(#ff-emblem-gold)"
        strokeWidth="0.8"
        opacity="0.55"
      />

      {/* FF monogram */}
      <text
        x="80"
        y="126"
        textAnchor="middle"
        fontSize="62"
        fontWeight="700"
        letterSpacing="1"
        fill="url(#ff-emblem-gold)"
        fontFamily="var(--font-display), Georgia, 'Times New Roman', serif"
      >
        FF
      </text>

      {/* Hairline wings at the crest's widest point */}
      <rect x="0" y="87" width="26" height="1" fill="url(#ff-emblem-fade-l)" />
      <rect x="134" y="87" width="26" height="1" fill="url(#ff-emblem-fade-r)" />

      {/* Base flourish beneath the crest point */}
      <path
        d="M60 183 L100 183"
        stroke="url(#ff-emblem-gold)"
        strokeWidth="1"
        opacity="0.75"
      />
      <circle cx="80" cy="183" r="2.2" fill="url(#ff-emblem-gold)" />
    </svg>
  );
}
