"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/domain/shared/money";
import { checkoutSchema } from "@/lib/validation";
import { placeOrderAction, getShippingQuoteAction } from "@/app/checkout/actions";
import type {
  ShippingMethod,
  ShippingQuote,
  ShippingQuoteOption,
} from "@/domain/shipping/shipping";
import { CountrySelect, type CountryOption } from "./CountrySelect";

interface FormState {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  country: string;
  state: string;
  city: string;
  postal: string;
  address: string;
  apartment: string;
}

export interface CheckoutInitial extends FormState {
  lat: number | null;
  lng: number | null;
}

const METHOD_LABEL: Record<ShippingMethod, string> = {
  standard: "Standard",
  express: "Express",
};

function deliveryDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function CheckoutForm({
  initial,
  countries,
}: {
  initial?: CheckoutInitial;
  countries: CountryOption[];
}) {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();

  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    countryCode: initial?.countryCode ?? "",
    country: initial?.country ?? "",
    state: initial?.state ?? "",
    city: initial?.city ?? "",
    postal: initial?.postal ?? "",
    address: initial?.address ?? "",
    apartment: initial?.apartment ?? "",
  });
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const itemsKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.variantId}:${i.qty}`).join(","),
    [items],
  );

  // Fetch a fresh shipping quote whenever the country or cart changes.
  useEffect(() => {
    const code = form.countryCode;
    if (!code || items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    getShippingQuoteAction({
      countryCode: code,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.quote) {
          setQuote(res.quote);
          const available = res.quote.options.map((o) => o.method);
          if (!available.includes(method) && available.length > 0) {
            setMethod(available[0]);
          }
        } else {
          setQuote(null);
          setQuoteError(res.error ?? "Could not calculate shipping.");
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.countryCode, itemsKey]);

  const selectedOption: ShippingQuoteOption | null =
    quote?.options.find((o) => o.method === method) ?? null;

  const displayCurrency = quote?.currency ?? items[0]?.currency ?? "NGN";
  const convFactor = quote && subtotal > 0 ? quote.subtotal / subtotal : 1;
  const shownSubtotal = quote?.subtotal ?? subtotal;
  const shippingCost = selectedOption?.cost ?? 0;
  const shownTotal = shownSubtotal + shippingCost;

  async function useMyLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { Accept: "application/json" } },
          );
          if (res.ok) {
            const data = await res.json();
            const a = data.address ?? {};
            const cc = (a.country_code ?? "").toUpperCase();
            const match = countries.find((c) => c.code === cc);
            setForm((f) => ({
              ...f,
              address:
                f.address ||
                [a.house_number, a.road].filter(Boolean).join(" ") ||
                data.display_name?.split(",")[0] ||
                "",
              city: f.city || a.city || a.town || a.village || a.suburb || "",
              state: f.state || a.state || "",
              postal: f.postal || a.postcode || "",
              countryCode: f.countryCode || (match ? match.code : ""),
              country: f.country || (match ? match.name : (a.country ?? "")),
            }));
          }
        } catch {
          /* keep coordinates; user can type the address */
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enter your address manually."
            : "Couldn't get your location — enter your address manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      countryCode: form.countryCode,
      country: form.country,
      state: form.state,
      city: form.city,
      postal: form.postal,
      address: form.address,
      apartment: form.apartment || null,
      method,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
    };

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const result = await placeOrderAction(parsed.data);
    if (result.ok && result.orderId) {
      clear();
      router.push(`/account/orders/${result.orderId}?placed=1`);
    } else {
      setSubmitting(false);
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-10 text-center">
        <p className="text-gray-400">Your bag is empty.</p>
        <Link
          href="/collections"
          className="mt-6 inline-block rounded-sm bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-600"
        >
          Shop collections
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-sm border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-500";
  const label = "mb-1 block text-xs uppercase tracking-widest text-gray-400";

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Shipping address */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shipping address</h2>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 px-4 py-2 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Use my location
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ck-name">Full name</label>
            <input id="ck-name" className={field} value={form.name} onChange={set("name")} autoComplete="name" />
          </div>
          <div>
            <label className={label} htmlFor="ck-email">Email address</label>
            <input id="ck-email" type="email" className={field} value={form.email} onChange={set("email")} autoComplete="email" />
          </div>
          <div>
            <label className={label} htmlFor="ck-phone">Phone number</label>
            <input id="ck-phone" className={field} value={form.phone} onChange={set("phone")} autoComplete="tel" />
          </div>
          <div>
            <label className={label} htmlFor="ck-country">Country</label>
            <CountrySelect
              id="ck-country"
              countries={countries}
              value={form.countryCode}
              onChange={(code, name) =>
                setForm((f) => ({ ...f, countryCode: code, country: name }))
              }
            />
          </div>
          <div>
            <label className={label} htmlFor="ck-state">State / Province</label>
            <input id="ck-state" className={field} value={form.state} onChange={set("state")} autoComplete="address-level1" />
          </div>
          <div>
            <label className={label} htmlFor="ck-city">City</label>
            <input id="ck-city" className={field} value={form.city} onChange={set("city")} autoComplete="address-level2" />
          </div>
          <div>
            <label className={label} htmlFor="ck-postal">ZIP / Postal code</label>
            <input id="ck-postal" className={field} value={form.postal} onChange={set("postal")} autoComplete="postal-code" />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="ck-address">Street address</label>
            <input id="ck-address" className={field} value={form.address} onChange={set("address")} autoComplete="street-address" />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="ck-apt">Apartment / Suite (optional)</label>
            <input id="ck-apt" className={field} value={form.apartment} onChange={set("apartment")} autoComplete="address-line2" />
          </div>
        </div>

        {/* Shipping method */}
        <div className="pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Shipping method
          </h3>
          {!form.countryCode ? (
            <p className="mt-2 text-sm text-gray-500">
              Select your country to see shipping options.
            </p>
          ) : quoteLoading ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculating shipping…
            </p>
          ) : quoteError ? (
            <p className="mt-2 text-sm text-red-400">{quoteError}</p>
          ) : quote && quote.options.length > 0 ? (
            <div className="mt-3 space-y-2">
              {quote.options.map((opt) => (
                <label
                  key={opt.method}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    method === opt.method
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-white/15 hover:border-white/30"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="method"
                      checked={method === opt.method}
                      onChange={() => setMethod(opt.method)}
                      className="h-4 w-4 accent-yellow-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-100">
                        {METHOD_LABEL[opt.method]}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {deliveryDate(opt.minDays)} – {deliveryDate(opt.maxDays)}{" "}
                        ({opt.minDays}–{opt.maxDays} days)
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-yellow-400">
                    {opt.free ? "FREE" : formatMoney(opt.cost, opt.currency)}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No shipping options available for this destination.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Summary */}
      <div className="h-fit rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 space-y-3">
          {items.map((i) => (
            <div key={`${i.productId}-${i.variantId}`} className="flex items-center gap-3">
              <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-neutral-900">
                <Image src={i.image} alt={i.name} fill className="object-cover" />
              </div>
              <div className="flex-1 text-sm">
                <p className="line-clamp-1">{i.name}</p>
                <p className="text-gray-400">Qty {i.qty}</p>
              </div>
              <p className="text-sm text-yellow-400">
                {formatMoney(Math.round(i.price * i.qty * convFactor), displayCurrency)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal</span>
            <span>{formatMoney(shownSubtotal, displayCurrency)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>
              Shipping
              {selectedOption ? ` · ${METHOD_LABEL[selectedOption.method]}` : ""}
            </span>
            <span>
              {!form.countryCode
                ? "—"
                : selectedOption
                  ? selectedOption.free
                    ? "FREE"
                    : formatMoney(shippingCost, displayCurrency)
                  : "—"}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(shownTotal, displayCurrency)}</span>
          </div>
          {quote && quote.currency !== "NGN" && (
            <p className="pt-1 text-xs text-gray-500">
              Charged in {quote.currency} for international delivery.
            </p>
          )}
          {selectedOption && (
            <p className="pt-1 text-xs text-gray-400">
              Estimated delivery {deliveryDate(selectedOption.minDays)} –{" "}
              {deliveryDate(selectedOption.maxDays)}.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !form.countryCode || !selectedOption}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 py-4 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Placing order…
            </>
          ) : (
            "Place order"
          )}
        </button>
        <p className="mt-2 text-center text-xs text-gray-500">
          Payment on delivery. Online payment coming soon.
        </p>
      </div>
    </form>
  );
}
