/** Generate a human-friendly, unique-ish tracking number, e.g. "FF-7K9Q2-M4XPT".
 *  DB uniqueness is enforced by a unique index; callers retry on collision. */
export function generateTrackingNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let s = "";
  for (let i = 0; i < 10; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FF-${s.slice(0, 5)}-${s.slice(5)}`;
}
