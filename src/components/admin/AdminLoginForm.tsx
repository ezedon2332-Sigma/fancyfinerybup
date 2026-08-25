"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

import { authClient } from "@/infrastructure/auth/client";
import { toast } from "@/components/ui/Toast";

const FIELD =
  "w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yellow-500";

/**
 * Staff sign-in form.
 *
 * Deliberately spare: no OAuth button, no magic link, no "create account". An
 * admin account is provisioned by seed or by invitation, never self-served, so
 * offering a sign-up route here would advertise something that does not exist.
 */
export function AdminLoginForm({
  signedInAsCustomer,
}: {
  signedInAsCustomer: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();

    start(async () => {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) {
        if (err.code === "EMAIL_NOT_VERIFIED") {
          toast.error("This address has not been confirmed yet.");
        } else {
          // One message for wrong-password and unknown-account alike: telling a
          // stranger which staff addresses exist is a gift to someone guessing.
          toast.error("Those credentials were not accepted.");
        }
        return;
      }

      const target = searchParams.get("redirect");
      const safe =
        target && target.startsWith("/") && !target.startsWith("//")
          ? target
          : "/admin";
      // A customer signing in here gets a customer session and the /admin
      // layout's requireAdmin() will bounce them — the gate, not this form,
      // is what decides.
      router.replace(safe);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="Fancy Finery"
          width={128}
          height={128}
          className="h-14 w-14 object-contain"
        />
        <h1 className="brand-wordmark mt-4 text-xl tracking-[0.16em]">
          FANCY FINERY
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.3em] text-yellow-600">
          <Lock className="h-3 w-3" /> Staff Access
        </p>
      </div>

      {signedInAsCustomer && (
        <p className="mb-4 rounded-xl border border-yellow-600/30 bg-yellow-500/5 px-4 py-3 text-xs text-gray-300">
          You are signed in, but this account does not have admin access. Sign in
          with a staff account below.
        </p>
      )}

      <form
        onSubmit={submit}
        className="space-y-3 rounded-2xl border border-white/10 bg-neutral-950/70 p-6"
      >
        <input
          className={FIELD}
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={FIELD}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />


        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-600">
        Admin accounts are issued by invitation. Shopping instead?{" "}
        <a href="/login" className="text-gray-400 underline hover:text-yellow-400">
          Customer sign in
        </a>
      </p>
    </div>
  );
}
