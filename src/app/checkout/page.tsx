import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { CountryOption } from "@/components/checkout/CountrySelect";
import { getCurrentProfile, requireUser } from "@/infrastructure/auth/session";
import { onlinePaymentEnabled } from "@/infrastructure/payments/providers";
import { COUNTRIES } from "@/domain/shipping/countries";
import { loadCountryRates } from "@/infrastructure/db/rate-card";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const profile = await getCurrentProfile();
  const a = profile?.address;

  // The full ISO set. With the shipping module removed there is no per-country
  // enable/disable list, so every destination is selectable.
  const countries: CountryOption[] = COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
  }));

  // Published rate card per destination, for the browse-by-country section.
  // Read on the server so the section is present on first paint.
  const rateCards = await loadCountryRates();

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
          paymentEnabled={onlinePaymentEnabled()}
          rateCards={rateCards}
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
