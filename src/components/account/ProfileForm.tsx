"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";

import type { Profile } from "@/domain/entities/profile";
import { profileSchema } from "@/lib/validation";
import { updateProfile } from "@/app/account/actions";
import { toast } from "@/components/ui/Toast";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: profile.fullName ?? "",
    phone: profile.address.phone ?? "",
    address: profile.address.address ?? "",
    city: profile.address.city ?? "",
    state: profile.address.state ?? "",
    country: profile.address.country ?? "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile.address.lat != null && profile.address.lng != null
      ? { lat: profile.address.lat, lng: profile.address.lng }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't supported on this device.");
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
            const d = await res.json();
            const a = d.address ?? {};
            setForm((f) => ({
              ...f,
              address:
                f.address ||
                [a.house_number, a.road].filter(Boolean).join(" ") ||
                d.display_name?.split(",")[0] ||
                "",
              city: f.city || a.city || a.town || a.village || a.suburb || "",
              state: f.state || a.state || "",
              country: f.country || a.country || "",
            }));
          }
        } catch {
          /* keep coords */
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — enter it manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const payload = {
      fullName: form.fullName || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const res = await updateProfile(parsed.data);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    } else {
      toast.error(res.error ?? "Could not save.");
    }
  }

  const field =
    "w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-yellow-500";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Profile & saved delivery address
        </h2>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 px-4 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          Use my location
        </button>
      </div>

      {coords && (
        <p className="rounded-md bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          Location saved ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}).
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Full name" value={form.fullName} onChange={set("fullName")} />
        <input className={field} placeholder="Phone" value={form.phone} onChange={set("phone")} />
      </div>
      <input className={field} placeholder="Street address" value={form.address} onChange={set("address")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={field} placeholder="City" value={form.city} onChange={set("city")} />
        <input className={field} placeholder="State" value={form.state} onChange={set("state")} />
        <input className={field} placeholder="Country" value={form.country} onChange={set("country")} />
      </div>


      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-sm bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Saved" : "Save profile"}
      </button>
    </form>
  );
}
