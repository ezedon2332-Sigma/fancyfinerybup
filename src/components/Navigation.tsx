import Image from "next/image";
import Link from "next/link";

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-6 border-b border-yellow-600 bg-black/90 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Image
          src="/logo.png"
          alt="Fancy Finery Logo"
          width={200}
          height={200}
          priority
        />

        <div>
          <h1 className="text-2xl font-bold tracking-[4px] text-yellow-400">
            FANCY FINERY
          </h1>
          <p className="text-xs uppercase tracking-[6px] text-gray-400">
            Luxury Fashion House
          </p>
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-8 text-sm uppercase tracking-widest">
        <Link href="/" className="hover:text-yellow-400 transition">
          Home
        </Link>
        <Link href="/collections" className="hover:text-yellow-400 transition">
          Collections
        </Link>
        <Link href="/contact" className="hover:text-yellow-400 transition">
          Contact
        </Link>
      </div>

      <div className="flex items-center gap-5 text-xl">
        <button className="hover:text-yellow-400 transition" type="button">
          🔍
        </button>
        <button className="hover:text-yellow-400 transition" type="button">
          ♡
        </button>
        <button className="hover:text-yellow-400 transition" type="button">
          🛍️
        </button>
        <button className="hover:text-yellow-400 transition" type="button">
          👤
        </button>
      </div>
    </nav>
  );
}
