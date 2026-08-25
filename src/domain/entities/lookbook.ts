/**
 * One panel of the Lookbook.
 *
 * Deliberately not a `Product`: a lookbook panel needs exactly a picture, a
 * name, a line of copy and somewhere to go. Carrying the whole aggregate would
 * hand the view stock levels, weights and pricing it has no business rendering.
 */
export interface LookbookEntry {
  slug: string;
  name: string;
  description: string | null;
  /** Resolved to a URL by the view via resolveMediaUrl. */
  storagePath: string;
}
