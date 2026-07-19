import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { CountryOption } from "@/components/checkout/CountrySelect";
import { getCurrentProfile, requireUser } from "@/infrastructure/supabase/auth";
import { getShippingRepository } from "@/infrastructure/supabase/shipping-service";
import { COUNTRIES } from "@/domain/shipping/countries";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const profile = await getCurrentProfile();
  const a = profile?.address;

  // Enabled shipping destinations (alphabetical). Fall back to the full ISO set
  // if the shipping tables aren't reachable, so the page never hard-fails.
  let countries: CountryOption[];
  try {
    const enabled = await getShippingRepository().then((r) =>
      r.listEnabledCountries(),
    );
    countries =
      enabled.length > 0
        ? enabled.map((c) => ({ code: c.code, name: c.name }))
        : COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
  } catch {
    countries = COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
  }

  // Resolve the saved country name back to a code, if possible.
  const savedCode =
    countries.find(
      (c) => c.name.toLowerCase() === (a?.country ?? "").toLowerCase(),
    )?.code ?? "";

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-gray-400">
        Signed in as {user.email}. Add your shipping details below.
      </p>
      <div className="mt-8">
        <CheckoutForm
          countries={countries}
          initial={{
            name: profile?.fullName ?? "",
            email: user.email ?? "",
            phone: a?.phone ?? "",
            countryCode: savedCode,
            country: a?.country ?? "",
            state: a?.state ?? "",
            city: a?.city ?? "",
            postal: "",
            address: a?.address ?? "",
            apartment: "",
            lat: a?.lat ?? null,
            lng: a?.lng ?? null,
          }}
        />
      </div>
    </div>
  );
}
