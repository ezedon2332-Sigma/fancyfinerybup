export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-6 py-16 lg:px-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500">
            Get in touch
          </p>
          <h1 className="mt-3 text-4xl font-bold text-yellow-500 sm:text-5xl">
            Contact Us
          </h1>
        </div>

        <div className="mt-12 space-y-6 text-center">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
              Email
            </h2>
            <a
              href="mailto:fancyxquisite@gmail.com"
              className="mt-1 inline-block text-lg text-gray-200 transition-colors hover:text-yellow-400"
            >
              fancyxquisite@gmail.com
            </a>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
              Phone
            </h2>
            <a
              href="tel:+2349021223344"
              className="mt-1 inline-block text-lg text-gray-200 transition-colors hover:text-yellow-400"
            >
              +234 902 122 3344
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
