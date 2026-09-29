import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import type { CountryOption } from "@/components/checkout/CountrySelect";
import { getCurrentProfile, requireUser } from "@/infrastructure/auth/session";
import { isCurrencyPayable } from "@/infrastructure/payments/providers";
import { DISPLAY_CURRENCIES } from "@/domain/shared/display-price";
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

  // Which currencies an online provider can actually settle.
  //
  // This was `onlinePaymentEnabled()`, which is global: true as soon as ANY one
  // provider is configured. Paystack is, so every shopper was promised
  // "Continue to payment" — including one paying in EUR or GBP, which only
  // Stripe settles. Their order was placed, no provider could take it, and it
  // became pay-on-delivery without anyone being told. Nothing looked broken;
  // the money simply never arrived.
  //
  // The whole set is sent so the form can react to the shopper switching
  // currency in the header, rather than trusting a snapshot taken here.
  const payableCurrencies = DISPLAY_CURRENCIES.filter(isCurrencyPayable);

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
          payableCurrencies={payableCurrencies}
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
