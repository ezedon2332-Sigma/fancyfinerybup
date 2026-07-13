import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { requireUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-gray-400">
        Signed in as {user.email}. Add your delivery details below.
      </p>
      <div className="mt-8">
        <CheckoutForm />
      </div>
    </div>
  );
}
