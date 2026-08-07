import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { SignInStub } from "@/components/auth/SignInStub";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  // A valid session never sees the sign-in screen.
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <SignInStub />
    </div>
  );
}
