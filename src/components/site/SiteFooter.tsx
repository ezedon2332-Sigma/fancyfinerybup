import Link from "next/link";
import { AtSign, Send, Share2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-yellow-600/30 bg-black text-gray-400">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
        <div>
          <h3 className="text-lg font-bold tracking-[3px] text-yellow-400">
            FANCY FINERY
          </h3>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Luxury fashion house — where craftsmanship meets timeless elegance.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white">
            Shop
          </h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/collections" className="hover:text-yellow-400">
                Collections
              </Link>
            </li>
            <li>
              <Link href="/collections?category=dresses" className="hover:text-yellow-400">
                Dresses
              </Link>
            </li>
            <li>
              <Link href="/collections?category=outerwear" className="hover:text-yellow-400">
                Outerwear
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white">
            Company
          </h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/contact" className="hover:text-yellow-400">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-yellow-400">
                My Account
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-white">
            Follow
          </h4>
          <div className="mt-4 flex gap-4">
            <a href="#" aria-label="Instagram" className="hover:text-yellow-400">
              <AtSign className="h-5 w-5" />
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-yellow-400">
              <Share2 className="h-5 w-5" />
            </a>
            <a href="#" aria-label="Twitter" className="hover:text-yellow-400">
              <Send className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Fancy Finery. All rights reserved.
      </div>
    </footer>
  );
}
