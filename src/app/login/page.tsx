import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-5 py-16 sm:px-6">
      <AuthPanel mode="signin" />
    </div>
  );
}
