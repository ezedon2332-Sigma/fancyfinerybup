import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fancy Finery — Luxury Fashion House",
    template: "%s · Fancy Finery",
  },
  description:
    "Fancy Finery — a curated luxury fashion house. Shop refined ready-to-wear and statement pieces.",
};

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CartProvider } from "@/components/cart/CartProvider";
import { CurrencyProvider } from "@/components/providers/CurrencyProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { getShippingRepository } from "@/infrastructure/supabase/shipping-service";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let ngnPerUsd = DEFAULT_NGN_PER_USD;
  try {
    ngnPerUsd = (await getShippingRepository().then((r) => r.getSettings()))
      .ngnPerUsd;
  } catch {
    /* shipping settings unavailable — use default rate */
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-white">
        <LanguageProvider>
          <CurrencyProvider rate={ngnPerUsd}>
            <CartProvider>
              <SiteHeader />
              <main className="flex-1 pt-16 lg:pt-[104px]">{children}</main>
              <SiteFooter />
            </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
