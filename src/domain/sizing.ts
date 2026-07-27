/** Size & fit vocabulary and the recommendation engine.
 *
 *  Pure: no framework, no I/O, no clock. The product page, the size guide and
 *  the admin editor all read from here, so a chart change lands everywhere at
 *  once and the recommendation can be tested without rendering anything. */

export const CLOTHING_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "5XL",
] as const;
export type ClothingSize = (typeof CLOTHING_SIZES)[number];

/** EU shoe sizes, the scale the catalogue quotes. */
export const SHOE_SIZES = [
  "35", "36", "37", "38", "39", "40", "41",
  "42", "43", "44", "45", "46", "47", "48",
] as const;

export const FIT_TYPES = [
  { id: "slim", label: "Slim Fit", note: "Cut close to the body." },
  { id: "regular", label: "Regular Fit", note: "True to size, easy through the body." },
  { id: "relaxed", label: "Relaxed Fit", note: "Generous through the body and sleeve." },
  { id: "oversized", label: "Oversized Fit", note: "Deliberately loose — size down for a closer line." },
] as const;
export type FitType = (typeof FIT_TYPES)[number]["id"];

export function fitLabel(id: string): string {
  return FIT_TYPES.find((f) => f.id === id)?.label ?? "Regular Fit";
}
export function fitNote(id: string): string | null {
  return FIT_TYPES.find((f) => f.id === id)?.note ?? null;
}

/** A garment's own measurements, in centimetres, for the size guide table. */
export interface SizeRow {
  size: string;
  chestCm?: [number, number];
  waistCm?: [number, number];
  hipCm?: [number, number];
  sleeveCm?: number;
  inseamCm?: number;
  /** Body ranges the recommendation reads. */
  heightCm: [number, number];
  weightKg: [number, number];
}

export interface SizeChart {
  id: string;
  name: string;
  /** Which catalogue the chart belongs to. */
  audience: "men" | "women" | "children" | "unisex";
  rows: SizeRow[];
}

// --- Selector ranges ---------------------------------------------------------

/** 140–200 cm in 5 cm steps, plus an open top. Coarser than 1 cm on purpose:
 *  a shopper does not know their height to the centimetre, and a long list is
 *  harder to use than a short one. */
export const HEIGHT_OPTIONS_CM: number[] = Array.from(
  { length: 13 },
  (_, i) => 140 + i * 5,
);

/** 35–180 kg in 5 kg steps. */
export const WEIGHT_OPTIONS_KG: number[] = Array.from(
  { length: 30 },
  (_, i) => 35 + i * 5,
);

/** 178 cm -> `5'10"`. Rounds to the nearest inch, carrying 12" to a foot. */
export function cmToFeetInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462);
}

// --- Recommendation ----------------------------------------------------------

export interface Recommendation {
  size: string;
  /** `exact` when both height and weight land inside the row; `weight` when
   *  only weight matched; `nearest` when the body is outside every row. */
  basis: "exact" | "weight" | "nearest";
  /** Plain-language reason, shown to the shopper. */
  reason: string;
}

/**
 * Recommend a size from height and weight.
 *
 * Weight leads because it drives girth, which is what actually decides whether
 * a garment closes; height is a tie-breaker between rows that both accept the
 * weight. When the body sits outside every row the nearest end is returned
 * rather than nothing — a shopper is better served by "closest is 5XL, check
 * the guide" than by silence — and `basis` says so, so the UI can hedge.
 *
 * `availableSizes` restricts the answer to what the product actually stocks:
 * recommending a size that cannot be bought is worse than not recommending.
 */
export function recommendSize(
  chart: SizeChart,
  heightCm: number,
  weightKg: number,
  availableSizes?: string[],
): Recommendation | null {
  // `undefined` means "no restriction"; an empty array means "nothing is
  // stocked" and must yield nothing. Collapsing the two would recommend a size
  // that cannot be bought, which is the exact failure this argument prevents.
  const stocked =
    availableSizes === undefined
      ? chart.rows
      : chart.rows.filter((r) => availableSizes.includes(r.size));
  if (stocked.length === 0) return null;

  const byWeight = stocked.filter(
    (r) => weightKg >= r.weightKg[0] && weightKg <= r.weightKg[1],
  );

  if (byWeight.length > 0) {
    const exact = byWeight.find(
      (r) => heightCm >= r.heightCm[0] && heightCm <= r.heightCm[1],
    );
    if (exact) {
      return {
        size: exact.size,
        basis: "exact",
        reason: `Best match for ${heightCm} cm and ${weightKg} kg.`,
      };
    }
    // Weight fits more than one row but the height fits none: prefer the row
    // whose height band is closest, so a tall, light shopper is not handed the
    // shortest cut available.
    const closest = [...byWeight].sort(
      (a, b) => heightDistance(a, heightCm) - heightDistance(b, heightCm),
    )[0];
    return {
      size: closest.size,
      basis: "weight",
      reason:
        heightCm > closest.heightCm[1]
          ? `Matched on weight. At ${heightCm} cm you are taller than this cut is drafted for — check the length in the size guide.`
          : `Matched on weight. At ${heightCm} cm you are shorter than this cut is drafted for — check the length in the size guide.`,
    };
  }

  // Outside every weight band: return the nearest end.
  const ordered = [...stocked].sort((a, b) => a.weightKg[0] - b.weightKg[0]);
  const lightest = ordered[0];
  const heaviest = ordered[ordered.length - 1];
  const below = weightKg < lightest.weightKg[0];
  const pick = below ? lightest : heaviest;

  return {
    size: pick.size,
    basis: "nearest",
    reason: below
      ? `${weightKg} kg is below our smallest drafted size. ${pick.size} is the closest — it may sit loose.`
      : `${weightKg} kg is above our largest drafted size. ${pick.size} is the closest — it may sit close.`,
  };
}

function heightDistance(row: SizeRow, heightCm: number): number {
  if (heightCm < row.heightCm[0]) return row.heightCm[0] - heightCm;
  if (heightCm > row.heightCm[1]) return heightCm - row.heightCm[1];
  return 0;
}

// --- Default charts ----------------------------------------------------------
//
// Starting points, editable in the admin. Ranges overlap slightly on purpose:
// bodies do not fall into disjoint boxes, and the height tie-breaker is what
// resolves the overlap.

export const DEFAULT_CHARTS: SizeChart[] = [
  {
    id: "men-standard",
    name: "Men — Standard",
    audience: "men",
    rows: [
      { size: "XS",  chestCm: [86, 91],   waistCm: [71, 76],   hipCm: [86, 91],   sleeveCm: 60, inseamCm: 76, heightCm: [155, 168], weightKg: [50, 58] },
      { size: "S",   chestCm: [91, 97],   waistCm: [76, 81],   hipCm: [91, 97],   sleeveCm: 61, inseamCm: 78, heightCm: [163, 173], weightKg: [58, 67] },
      { size: "M",   chestCm: [97, 102],  waistCm: [81, 87],   hipCm: [97, 102],  sleeveCm: 63, inseamCm: 80, heightCm: [168, 178], weightKg: [67, 77] },
      { size: "L",   chestCm: [102, 107], waistCm: [87, 92],   hipCm: [102, 107], sleeveCm: 64, inseamCm: 81, heightCm: [173, 185], weightKg: [77, 88] },
      { size: "XL",  chestCm: [107, 112], waistCm: [92, 98],   hipCm: [107, 112], sleeveCm: 65, inseamCm: 83, heightCm: [178, 190], weightKg: [88, 100] },
      { size: "XXL", chestCm: [112, 122], waistCm: [98, 108],  hipCm: [112, 122], sleeveCm: 66, inseamCm: 84, heightCm: [180, 195], weightKg: [100, 115] },
      { size: "3XL", chestCm: [122, 132], waistCm: [108, 118], hipCm: [122, 132], sleeveCm: 67, inseamCm: 84, heightCm: [180, 200], weightKg: [115, 132] },
      { size: "4XL", chestCm: [132, 142], waistCm: [118, 128], hipCm: [132, 142], sleeveCm: 68, inseamCm: 85, heightCm: [180, 200], weightKg: [132, 150] },
      { size: "5XL", chestCm: [142, 152], waistCm: [128, 138], hipCm: [142, 152], sleeveCm: 69, inseamCm: 85, heightCm: [180, 205], weightKg: [150, 175] },
    ],
  },
  {
    id: "women-standard",
    name: "Women — Standard",
    audience: "women",
    rows: [
      { size: "XS",  chestCm: [76, 81],   waistCm: [58, 63],   hipCm: [84, 89],   sleeveCm: 57, inseamCm: 74, heightCm: [150, 162], weightKg: [40, 48] },
      { size: "S",   chestCm: [81, 86],   waistCm: [63, 68],   hipCm: [89, 94],   sleeveCm: 58, inseamCm: 76, heightCm: [155, 167], weightKg: [48, 56] },
      { size: "M",   chestCm: [86, 91],   waistCm: [68, 74],   hipCm: [94, 99],   sleeveCm: 59, inseamCm: 77, heightCm: [160, 172], weightKg: [56, 65] },
      { size: "L",   chestCm: [91, 97],   waistCm: [74, 81],   hipCm: [99, 105],  sleeveCm: 60, inseamCm: 78, heightCm: [163, 175], weightKg: [65, 75] },
      { size: "XL",  chestCm: [97, 104],  waistCm: [81, 88],   hipCm: [105, 112], sleeveCm: 61, inseamCm: 79, heightCm: [165, 178], weightKg: [75, 87] },
      { size: "XXL", chestCm: [104, 114], waistCm: [88, 98],   hipCm: [112, 122], sleeveCm: 62, inseamCm: 79, heightCm: [165, 180], weightKg: [87, 100] },
      { size: "3XL", chestCm: [114, 124], waistCm: [98, 108],  hipCm: [122, 132], sleeveCm: 63, inseamCm: 80, heightCm: [165, 182], weightKg: [100, 118] },
      { size: "4XL", chestCm: [124, 134], waistCm: [108, 118], hipCm: [132, 142], sleeveCm: 64, inseamCm: 80, heightCm: [165, 185], weightKg: [118, 138] },
      { size: "5XL", chestCm: [134, 144], waistCm: [118, 128], hipCm: [142, 152], sleeveCm: 65, inseamCm: 81, heightCm: [165, 188], weightKg: [138, 160] },
    ],
  },
  {
    id: "children-standard",
    name: "Children — Standard",
    audience: "children",
    rows: [
      { size: "XS", chestCm: [56, 61], waistCm: [52, 55], hipCm: [58, 63], sleeveCm: 36, inseamCm: 40, heightCm: [98, 110],  weightKg: [15, 19] },
      { size: "S",  chestCm: [61, 66], waistCm: [55, 58], hipCm: [63, 69], sleeveCm: 40, inseamCm: 46, heightCm: [110, 122], weightKg: [19, 24] },
      { size: "M",  chestCm: [66, 71], waistCm: [58, 61], hipCm: [69, 75], sleeveCm: 44, inseamCm: 52, heightCm: [122, 134], weightKg: [24, 30] },
      { size: "L",  chestCm: [71, 76], waistCm: [61, 65], hipCm: [75, 81], sleeveCm: 48, inseamCm: 58, heightCm: [134, 146], weightKg: [30, 38] },
      { size: "XL", chestCm: [76, 84], waistCm: [65, 70], hipCm: [81, 88], sleeveCm: 52, inseamCm: 64, heightCm: [146, 158], weightKg: [38, 48] },
    ],
  },
];

/** Chart for a category slug, defaulting to men's when unmapped. */
export function chartForCategory(slug: string | null | undefined): SizeChart {
  const key = (slug ?? "").toLowerCase();
  if (key.includes("women")) return DEFAULT_CHARTS[1];
  if (key.includes("child") || key.includes("kid")) return DEFAULT_CHARTS[2];
  return DEFAULT_CHARTS[0];
}

/** How to measure, for the guide modal. Wording is deliberately specific —
 *  "under the arms, across the fullest part" removes most of the guesswork. */
export const MEASURE_STEPS = [
  {
    part: "Chest",
    how: "Under the arms, around the fullest part, tape level and not pulled tight.",
  },
  {
    part: "Waist",
    how: "At the natural crease when you bend sideways — usually just above the navel.",
  },
  {
    part: "Hip",
    how: "Around the fullest part, feet together.",
  },
  {
    part: "Sleeve",
    how: "From the centre back of the neck, over the shoulder, to the wrist with the arm slightly bent.",
  },
  {
    part: "Inseam",
    how: "From the crotch seam to the hem along the inside of the leg.",
  },
] as const;
