"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export interface LookItem {
  image: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

/** Full-screen, interactive campaign panels — hover to zoom the photography and
 *  reveal the story, click to shop the look. */
export function LookbookGallery({ items }: { items: LookItem[] }) {
  return (
    <div>
      {items.map((it, i) => (
        <motion.div
          key={`${it.href}-${i}`}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <Link
            href={it.href}
            className="group relative block h-[70vh] w-full overflow-hidden sm:h-[85vh]"
          >
            <Image
              src={it.image}
              alt={it.title}
              fill
              sizes="100vw"
              className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.10),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

            <div
              className={`absolute inset-0 flex flex-col justify-end p-8 sm:p-16 ${
                i % 2 === 1 ? "items-end text-right" : "items-start"
              }`}
            >
              <div className="max-w-md translate-y-4 transition-transform duration-500 ease-out group-hover:translate-y-0">
                <p className="text-[11px] uppercase tracking-[6px] text-yellow-500">
                  The Lookbook · {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 text-4xl leading-tight sm:text-6xl">
                  {it.title}
                </h2>
                {it.subtitle && (
                  <p className="mt-3 line-clamp-2 max-w-sm text-sm text-gray-300 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    {it.subtitle}
                  </p>
                )}
                <span
                  className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-yellow-400 ${
                    i % 2 === 1 ? "flex-row-reverse" : ""
                  }`}
                >
                  Shop the look
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
