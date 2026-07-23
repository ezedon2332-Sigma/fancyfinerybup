/** Popular colour options for the on-demand colour request feature, plus a
 *  hex lookup for rendering swatches. Shared by the request modal and admin. */

export const POPULAR_COLORS = [
  "Black",
  "White",
  "Navy Blue",
  "Royal Blue",
  "Sky Blue",
  "Green",
  "Emerald Green",
  "Yellow",
  "Mustard",
  "Orange",
  "Pink",
  "Purple",
  "Brown",
  "Beige",
  "Grey",
  "Wine",
  "Red",
] as const;

const HEX: Record<string, string> = {
  black: "#111111",
  white: "#f5f5f0",
  "navy blue": "#1e293b",
  "royal blue": "#1d4ed8",
  "sky blue": "#38bdf8",
  green: "#16a34a",
  "emerald green": "#059669",
  yellow: "#eab308",
  mustard: "#c9a227",
  orange: "#ea580c",
  pink: "#ec4899",
  purple: "#7c3aed",
  brown: "#6b4a2b",
  beige: "#d8c3a5",
  grey: "#6b7280",
  gray: "#6b7280",
  wine: "#722f37",
  red: "#b91c1c",
  gold: "#eab308",
  silver: "#c0c0c0",
  cream: "#f3ead6",
  ivory: "#fffff0",
  tan: "#d2b48c",
  teal: "#0d9488",
  turquoise: "#14b8a6",
};

/** Best-effort hex for a colour name (falls back to a neutral swatch). */
export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (HEX[key]) return HEX[key];
  // If the value already looks like a hex code, use it directly.
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) return key;
  return "#9ca3af";
}

export const COLOR_REQUEST_STATUSES = [
  "pending",
  "available",
  "in_production",
  "ready",
  "completed",
  "cancelled",
] as const;

export type ColorRequestStatus = (typeof COLOR_REQUEST_STATUSES)[number];

export const COLOR_REQUEST_STATUS_LABEL: Record<ColorRequestStatus, string> = {
  pending: "Pending",
  available: "Available",
  in_production: "In Production",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const COLOR_REQUEST_STATUS_BADGE: Record<ColorRequestStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  available: "bg-emerald-500/15 text-emerald-400",
  in_production: "bg-blue-500/15 text-blue-400",
  ready: "bg-indigo-500/15 text-indigo-400",
  completed: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
};
