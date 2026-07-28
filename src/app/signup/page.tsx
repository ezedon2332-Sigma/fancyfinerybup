import { Suspense } from "react";
import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Fancy Finery account to save addresses, track orders and review your pieces.",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <header className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-500">
            Fancy Finery
          </p>
          <h1 className="brand-wordmark mt-5 text-3xl tracking-[0.04em]">
            Create your account
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            One account for orders, addresses and the pieces you love.
          </p>
        </header>

        <Card className="mt-8 p-6 sm:p-7">
          <Suspense fallback={null}>
            <SignUpForm />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
