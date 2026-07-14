"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import type { ProductSummary } from "@/domain/entities/product";
import { formatMoney } from "@/domain/shared/money";
import { resolveImageUrl } from "@/infrastructure/supabase/image-url";
import { ProductGrid } from "./ProductGrid";

const MAX_SUGGESTIONS = 6;

/** Lowercase + strip accents so "Amber" matches "ámber". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Are all chars of `q` present, in order, inside `text`? (typo/gap tolerant) */
function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Relevance score for a product against the normalized query `q` and its
 * word `tokens`. Returns 0 when there is no match. Higher = more relevant.
 */
function scoreProduct(p: ProductSummary, q: string, tokens: string[]): number {
  const name = normalize(p.name);
  const desc = normalize(p.description ?? "");
  let score = 0;

  // Name matches — strongest signal, tiered by how tight the match is.
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 600;
  else if (new RegExp(`\\b${escapeRegExp(q)}`).test(name)) score += 400;
  else if (name.includes(q)) score += 250;

  // Every query word that appears in the name adds weight.
  score += tokens.filter((t) => name.includes(t)).length * 60;

  // Description matches — weaker, only meaningful when the name didn't hit.
  if (score === 0 && desc.includes(q)) score += 90;
  if (score === 0) score += tokens.filter((t) => desc.includes(t)).length * 25;

  // Fuzzy fallback: catches typos / dropped letters in the name.
  if (score === 0 && q.length >= 3 && isSubsequence(q, name)) score += 40;

  return score;
}

/** Renders `text` with the first occurrence of `query` highlighted. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = normalize(text).indexOf(normalize(q));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-yellow-400">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function ProductSearch({ products }: { products: ProductSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ranked = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return products;
    const tokens = q.split(/\s+/).filter(Boolean);
    return products
      .map((p) => ({ p, s: scoreProduct(p, q, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .map((x) => x.p);
  }, [products, query]);

  const trimmed = query.trim();
  const suggestions = ranked.slice(0, MAX_SUGGESTIONS);
  const showDropdown = open && trimmed.length > 0 && suggestions.length > 0;

  function goTo(product: ProductSummary) {
    setOpen(false);
    setActive(-1);
    router.push(`/products/${product.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && suggestions[active]) {
      e.preventDefault();
      goTo(suggestions[active]);
    }
  }

  return (
    <div>
      {/* Search input + live suggestions */}
      <div className="relative mx-auto max-w-md">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="product-search-listbox"
            aria-autocomplete="list"
            aria-label="Search products"
            value={query}
            placeholder="Search products…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so a click on a suggestion registers first.
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
            className="w-full rounded-full border border-white/20 bg-neutral-900 py-3 pl-11 pr-11 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-yellow-500"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setActive(-1);
                setOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:text-yellow-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showDropdown && (
          <ul
            id="product-search-listbox"
            role="listbox"
            onMouseDown={(e) => {
              // Keep focus so onBlur doesn't close before the click lands.
              e.preventDefault();
              if (blurTimer.current) clearTimeout(blurTimer.current);
            }}
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-yellow-600/30 bg-neutral-950/95 shadow-xl backdrop-blur"
          >
            {suggestions.map((p, i) => {
              const src = p.primaryImage
                ? resolveImageUrl(p.primaryImage.storagePath)
                : "/image.jpeg";
              return (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <Link
                    href={`/products/${p.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goTo(p)}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      i === active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-100">
                        <Highlight text={p.name} query={query} />
                      </span>
                      <span className="text-xs text-yellow-400/90">
                        {formatMoney(p.price, p.currency)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Result count */}
      {trimmed.length > 0 && (
        <p
          aria-live="polite"
          className="mt-5 text-center text-xs uppercase tracking-widest text-gray-400"
        >
          {ranked.length} result{ranked.length === 1 ? "" : "s"} for “{trimmed}”
        </p>
      )}

      {/* Filtered grid */}
      <div className="mt-8">
        {trimmed.length > 0 && ranked.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-300">
              No products match “{trimmed}”.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-4 text-xs uppercase tracking-widest text-yellow-400 hover:text-yellow-300"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ProductGrid products={ranked} />
        )}
      </div>
    </div>
  );
}
