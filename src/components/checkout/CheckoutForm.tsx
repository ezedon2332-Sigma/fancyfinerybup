"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/domain/shared/money";
import { checkoutSchema } from "@/lib/validation";
import { placeOrderAction } from "@/app/checkout/actions";

interface FormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
};

export function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
        // Best-effort reverse geocode to prefill the address fields.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { Accept: "application/json" } },
          );
          if (res.ok) {
            const data = await res.json();
            const a = data.address ?? {};
            setForm((f) => ({
              ...f,
              address:
                f.address ||
                [a.house_number, a.road].filter(Boolean).join(" ") ||
                data.display_name?.split(",")[0] ||
                "",
              city: f.city || a.city || a.town || a.village || a.suburb || "",
              state: f.state || a.state || "",
              country: f.country || a.country || "",
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
      ...form,
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Delivery details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Delivery details</h2>
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

        {coords && (
          <p className="rounded-md bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
            Location captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}) —
            attached to your order for delivery.
          </p>
        )}

        <input className={field} placeholder="Full name" value={form.name} onChange={set("name")} autoComplete="name" />
        <input className={field} placeholder="Phone number" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        <input className={field} placeholder="Street address" value={form.address} onChange={set("address")} autoComplete="street-address" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input className={field} placeholder="City" value={form.city} onChange={set("city")} />
          <input className={field} placeholder="State" value={form.state} onChange={set("state")} />
          <input className={field} placeholder="Country" value={form.country} onChange={set("country")} />
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
                {formatMoney(i.price * i.qty, i.currency)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t border-white/10 pt-4">
          <span className="text-gray-400">Subtotal</span>
          <span className="text-lg font-semibold">
            {formatMoney(subtotal, items[0]?.currency ?? "NGN")}
          </span>
        </div>
        <button
          type="submit"
          disabled={submitting}
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
