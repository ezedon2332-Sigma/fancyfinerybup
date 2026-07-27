"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Truck } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { checkoutSchema } from "@/lib/validation";
import { placeOrderAction } from "@/app/checkout/actions";
import { startPaymentAction } from "@/app/checkout/payment-actions";
import { quoteShipping, type Quote } from "@/app/shipping/quote-actions";
import { OrderSummary } from "./OrderSummary";
import { CheckoutProgress } from "./CheckoutProgress";
import { ShippingSummary, TrustBadges } from "./ShippingSummary";
import { CountrySelect, type CountryOption } from "./CountrySelect";
import {
  RatesBrowser,
  type CountryRates,
} from "@/components/shipping/RatesBrowser";

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

export function CheckoutForm({
  initial,
  countries,
  paymentEnabled = false,
  rateCards = [],
}: {
  initial?: CheckoutInitial;
  countries: CountryOption[];
  paymentEnabled?: boolean;
  /** Published rate card per destination, for the browse section. */
  rateCards?: CountryRates[];
}) {
  const router = useRouter();
  const { items, clear } = useCart();

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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const requestId = useRef(0);

  // A stable key over the lines, so the quote refreshes when quantities change
  // but not on every unrelated re-render.
  const itemsKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.variantId}:${i.qty}`).join(","),
    [items],
  );

  // Requote whenever anything that can move the total moves: destination,
  // contents, quantity, or the coupon. Nothing is computed on the client.
  useEffect(() => {
    if (!form.countryCode || items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears a stale async quote when its inputs go away
      setQuote(null);
      return;
    }
    const id = ++requestId.current;
    setQuoting(true);
    quoteShipping({
      countryCode: form.countryCode,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
      })),
      couponCode: appliedCoupon,
    })
      .then((res) => {
        if (id !== requestId.current) return; // a newer quote has landed
        setQuote(res.ok ? res : null);
      })
      .finally(() => {
        if (id === requestId.current) setQuoting(false);
      });
  }, [form.countryCode, itemsKey, appliedCoupon, items]);

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
      courierId: quote?.selected?.courierId ?? null,
      couponCode: appliedCoupon,
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
      if (paymentEnabled) {
        const pay = await startPaymentAction(result.orderId);
        if (pay.ok && pay.url) {
          window.location.href = pay.url; // redirect to the payment provider
          return;
        }
        // Payment couldn't start — the order is placed; let them pay later.
        router.push(`/account/orders/${result.orderId}?placed=1`);
        return;
      }
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
    <form onSubmit={handleSubmit}>
      <div className="mx-auto mb-10 max-w-2xl">
        <CheckoutProgress current={form.countryCode ? "Payment" : "Shipping"} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
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

        {/* Delivery */}
        <div className="pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Delivery
          </h3>

          {form.countryCode && (
            <div className="mt-3">
              <ShippingSummary
                quote={quote}
                loading={quoting}
                countryName={form.country}
              />
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-yellow-600/40 bg-yellow-500/5 px-4 py-3">
            <Truck className="h-4 w-4 shrink-0 text-yellow-500" />
            <span className="min-w-0">
              <span className="block text-sm text-gray-100">
                {quote?.selected
                  ? `${quote?.selected.courierName} · ${
                      quote?.selected.minDays === quote?.selected.maxDays
                        ? `${quote?.selected.maxDays} days`
                        : `${quote?.selected.minDays}–${quote?.selected.maxDays} days`
                    }`
                  : form.countryCode
                    ? "Calculating your delivery option…"
                    : "Choose a country to see delivery options"}
              </span>
              <span className="block text-xs text-gray-400">
                We will confirm your dispatch date by email after your order is
                placed.
              </span>
            </span>
          </div>
        </div>

        {/* Browse rates by destination */}
        <div className="pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
            Browse Shipping Rates by Country
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            Every published band, so you can see exactly how your parcel is
            priced — and what it would cost elsewhere. Nothing is added after
            this.
          </p>
          <div className="mt-4">
            <RatesBrowser
              rates={rateCards}
              highlight={form.countryCode || null}
              compact
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Summary */}
      <div className="h-fit lg:sticky lg:top-[220px]">
        <OrderSummary
          items={items}
          quote={quote}
          loading={quoting}
          couponInput={couponInput}
          onCouponChange={setCouponInput}
          onApplyCoupon={() => setAppliedCoupon(couponInput.trim() || null)}
          onClearCoupon={() => {
            setAppliedCoupon(null);
            setCouponInput("");
          }}
          couponPending={quoting}
        />

        <button
          type="submit"
          disabled={submitting || !form.countryCode}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-yellow-500 py-4 font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {paymentEnabled ? "Redirecting to payment…" : "Placing order…"}
            </>
          ) : paymentEnabled ? (
            "Continue to payment"
          ) : (
            "Place order"
          )}
        </button>
        <p className="mt-2 text-center text-xs text-gray-500">
          {paymentEnabled
            ? "Secure payment • you'll confirm on the next screen."
            : "Payment on delivery."}
        </p>

        <TrustBadges />
      </div>
      </div>

      {/* Mobile: the pay button follows the customer rather than living at
          the bottom of a long form. Hidden once the desktop column, which
          already keeps it in view, takes over. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-yellow-600/30 bg-black/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Total
            </p>
            <p className="truncate text-sm font-semibold text-yellow-400">
              {quoting && !quote ? (
                <span className="inline-block h-4 w-20 animate-pulse rounded bg-white/10" />
              ) : quote ? (
                `${quote.currency === "NGN" ? "₦" : "$"}${(
                  quote.breakdown.total / 100
                ).toLocaleString()}`
              ) : (
                "—"
              )}
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !form.countryCode}
            className="shrink-0 rounded-sm bg-yellow-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-600 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : paymentEnabled ? (
              "Continue"
            ) : (
              "Place order"
            )}
          </button>
        </div>
      </div>
      {/* Spacer so the sticky bar never covers the last field. */}
      <div aria-hidden className="h-20 lg:hidden" />
    </form>
  );
}
