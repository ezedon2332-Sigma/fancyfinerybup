import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "../styles/globals.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Elegant serif for headings — the luxury display face. */
const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fancy Finery — Luxury Fashion House",
    template: "%s · Fancy Finery",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "luxury fashion",
    "designer clothing",
    "ready-to-wear",
    "Fancy Finery",
    "worldwide shipping",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Fancy Finery — Luxury Fashion House",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fancy Finery — Luxury Fashion House",
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { IntroSplash } from "@/components/site/IntroSplash";
import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { RecentlyViewedProvider } from "@/components/recent/RecentlyViewedProvider";
import { CurrencyProvider } from "@/components/providers/CurrencyProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { RateChangeNotifier } from "@/components/providers/RateChangeNotifier";
import { VipInvitationModal } from "@/components/newsletter/VipInvitationModal";
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
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-white">
        <IntroSplash />
        <LanguageProvider>
          <CurrencyProvider rate={ngnPerUsd} rates={displayRates} updatedAt={rateUpdatedAt}>
            <CartProvider>
              <WishlistProvider>
                <RecentlyViewedProvider>
                  <SiteHeader />
                  {/* Offset matches the fixed header exactly. Below lg the
                      header is just the nav (116 / 140); from lg the utility
                      bar adds 40 on top of a 164 nav. */}
                  <main className="flex-1 pt-[116px] sm:pt-[140px] lg:pt-[204px]">
                    {children}
                  </main>
                  <SiteFooter />
                  <RateChangeNotifier />
                  <VipInvitationModal />
                </RecentlyViewedProvider>
              </WishlistProvider>
            </CartProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
