const OFFICE_ADDRESS = "56 Sam Shonibare Street, Surulere, Lagos, Nigeria";
const MAPS_QUERY = encodeURIComponent(OFFICE_ADDRESS);
// Interactive embed — no API key required.
const MAPS_EMBED_URL = `https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`;
// Opens the location in Google Maps (web or app) for directions.
const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[6px] text-yellow-500">
            Get in touch
          </p>
          <h1 className="mt-3 text-4xl font-bold text-yellow-500 sm:text-5xl">
            Contact Us
          </h1>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* Details */}
          <div className="space-y-6">
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

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
                Office
              </h2>
              <p className="mt-1 text-lg text-gray-200">{OFFICE_ADDRESS}</p>
              <a
                href={MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-yellow-400 transition-colors hover:bg-yellow-500 hover:text-black"
              >
                Get Directions →
              </a>
            </div>
          </div>

          {/* Map */}
          <div className="overflow-hidden rounded-2xl border border-yellow-600/30">
            <iframe
              title="Fancy Finery office location — 56 Sam Shonibare Street, Surulere, Lagos"
              src={MAPS_EMBED_URL}
              width="100%"
              height="380"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}
