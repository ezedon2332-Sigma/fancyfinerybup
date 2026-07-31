/**
 * Password policy.
 *
 * The rule is the one the house asked for: at least eight characters, with an
 * uppercase letter, a lowercase letter, a digit and a symbol. It lives here as
 * a pure function so the browser and the server enforce the identical rule from
 * one definition — a client-only check is a suggestion, not a policy.
 *
 * `unmet` is returned rather than a single message on purpose: telling someone
 * "invalid password" and making them guess which rule they missed is how people
 * end up with `Password1!`. Showing the whole checklist, ticking off as they
 * type, is both kinder and faster.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Anything that is not a letter, a digit or whitespace counts as a symbol. */
const SYMBOL = /[^A-Za-z0-9\s]/;

export type RuleId = "length" | "upper" | "lower" | "digit" | "symbol";

export interface Rule {
  id: RuleId;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: readonly Rule[] = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (pw) => pw.length >= MIN_PASSWORD_LENGTH,
  },
  { id: "upper", label: "An uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "A lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { id: "digit", label: "A number", test: (pw) => /\d/.test(pw) },
  { id: "symbol", label: "A symbol", test: (pw) => SYMBOL.test(pw) },
];

export interface PolicyResult {
  valid: boolean;
  /** Rules the password does not yet satisfy, in checklist order. */
  unmet: RuleId[];
}

export function checkPassword(pw: string): PolicyResult {
  const input = typeof pw === "string" ? pw : "";
  const unmet = PASSWORD_RULES.filter((r) => !r.test(input)).map((r) => r.id);
  return { valid: unmet.length === 0, unmet };
}

/**
 * Strength for the meter, scored 0–4.
 *
 * Separate from `checkPassword` because they answer different questions: the
 * policy decides whether a password is allowed, this decides what the bar looks
 * like. A password can satisfy every rule and still be weak (`Passw0rd!`), so
 * length keeps contributing well past the minimum — that is what actually
 * resists guessing.
 */
export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function scorePassword(pw: string): Strength {
  const input = typeof pw === "string" ? pw : "";
  if (!input) return { score: 0, label: "" };

  const { unmet } = checkPassword(input);
  const met = PASSWORD_RULES.length - unmet.length;

  let points = 0;
  if (input.length >= MIN_PASSWORD_LENGTH) points++;
  if (input.length >= 12) points++;
  if (input.length >= 16) points++;
  if (met === PASSWORD_RULES.length) points++;
  // Variety on its own is worth something even before the length bar is met,
  // so a short-but-mixed password does not read as identical to "aaaa".
  if (met >= 4 && points === 0) points = 1;

  const score = Math.min(4, points) as Strength["score"];
  const label =
    score <= 1
      ? "Weak"
      : score === 2
        ? "Fair"
        : score === 3
          ? "Good"
          : "Strong";
  return { score, label };
}

/** Split a display name into the parts the profile stores. */
export function composeFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}
