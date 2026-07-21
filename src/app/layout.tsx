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
import { RateChangeNotifier } from "@/components/providers/RateChangeNotifier";
import {
  getExchangeRate,
  getDisplayRates,
} from "@/infrastructure/exchange-rate/service";
import type { DisplayRates } from "@/components/providers/CurrencyProvider";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let ngnPerUsd = DEFAULT_NGN_PER_USD;
  let rateUpdatedAt: string | null = null;
  let displayRates: DisplayRates | undefined;
  try {
    const [er, dr] = await Promise.all([getExchangeRate(), getDisplayRates()]);
    ngnPerUsd = er.ngnPerUsd;
    rateUpdatedAt = er.updatedAt;
    displayRates = dr;
  } catch {
    /* exchange rate unavailable — use default rate */
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-white">
        <LanguageProvider>
          <CurrencyProvider rate={ngnPerUsd} rates={displayRates} updatedAt={rateUpdatedAt}>
            <CartProvider>
              <SiteHeader />
              <main className="flex-1 pt-28 lg:pt-[136px]">{children}</main>
              <SiteFooter />
              <RateChangeNotifier />
            </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
