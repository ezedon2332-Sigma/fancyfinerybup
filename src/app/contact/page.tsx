import { BRAND_EMAIL } from "@/lib/site";

/**
 * Accepts `?order=REF` from the order page's "Problem with this order?" link,
 * so the customer arrives with their reference already on screen and support
 * does not have to ask for it.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  // Reference only — it is rendered back to the page, so keep it to the shape
  // the order page produces and nothing else.
  const orderRef =
    order && /^[A-Z0-9]{4,12}$/i.test(order) ? order.toUpperCase() : null;

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

        {orderRef && (
          <div className="mt-8 rounded-2xl border border-yellow-600/30 bg-yellow-500/5 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-widest text-yellow-500">
              About order
            </p>
            <p className="mt-1 font-mono text-lg text-gray-100">#{orderRef}</p>
            <p className="mt-2 text-sm text-gray-400">
              Quote this reference and we can find your order straight away.
            </p>
          </div>
        )}

        <div className="mt-12 space-y-6 text-center">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
              Email
            </h2>
            <a
              href={
                orderRef
                  ? `mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(`Order #${orderRef}`)}`
                  : `mailto:${BRAND_EMAIL}`
              }
              className="mt-1 inline-block text-lg text-gray-200 transition-colors hover:text-yellow-400"
            >
              {BRAND_EMAIL}
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
