/**
 * Serialise a value for embedding inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is NOT safe here. It escapes quotes and backslashes
 * but leaves `<` and `>` untouched, so any string reaching it — a product name,
 * a description, a category pulled from the database — can close the script tag
 * early and run whatever follows:
 *
 *   name: 'Gown</script><script>alert(1)</script>'
 *
 * Escaping the characters that matter as `\uXXXX` keeps the JSON valid (parsers
 * decode the escapes) while making tag breakout impossible. `&` is included
 * because it is the entry point for entity tricks in some parsing contexts.
 */

/** U+2028 and U+2029 are literal line terminators in JavaScript: left raw they
 *  break the parse. Built from char codes rather than written literally, so the
 *  characters never appear in this source file. */
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const LINE_SEPARATORS = new RegExp(`[${LS}${PS}]`, "g");

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATORS, (c) => (c === LS ? "\\u2028" : "\\u2029"));
}
