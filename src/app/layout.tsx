import { cookies } from "next/headers";
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
import { VipInvitationModal } from "@/components/newsletter/VipInvitationModal";
import {
  CURRENCY_COOKIE,
  isDisplayCurrency,
} from "@/domain/shared/display-price";

/**
 * The display currency is read from its cookie here so the very first paint is
 * already in the shopper's chosen currency — no flash of naira on a repeat
 * visit. This costs nothing: every route in this app is already server-rendered
 * on demand, so there is no static generation for `cookies()` to opt out of.
 * `CurrencyProvider` still reconciles against localStorage after mount, which
 * covers a cleared or blocked cookie.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value;
  const initialCurrency = isDisplayCurrency(cookieCurrency)
    ? cookieCurrency
    : "NGN";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black text-white">
        <IntroSplash />
        <LanguageProvider>
          <CurrencyProvider initialCurrency={initialCurrency}>
            <CartProvider>
              <WishlistProvider>
                <RecentlyViewedProvider>
                  <SiteHeader />
                  {/* No top padding: the header is sticky rather than fixed, so
                      it occupies its own height and there is no magic number to
                      keep in sync as the header reflows. */}
                  <main className="flex-1">
                    {children}
                  </main>
                  <SiteFooter />
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
