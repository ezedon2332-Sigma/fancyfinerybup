import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Fancy Finery.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
