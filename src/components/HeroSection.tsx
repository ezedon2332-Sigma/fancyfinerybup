import Image from "next/image";

export function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col lg:flex-row pt-28 lg:pt-36">
      <div className="w-full lg:w-7/12 pr-12 lg:pr-24 flex flex-col justify-center">
        <p className="uppercase tracking-[8px] text-yellow-500 text-sm">
          Luxury Fashion House
        </p>

        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mt-6">
          Timeless
          <br />
          Elegance
        </h1>

        <p className="max-w-2xl mt-8 text-gray-300 text-xl leading-relaxed">
          Experience fashion where luxury meets craftsmanship.
          Designed for those who appreciate excellence,
          confidence, and timeless style.
        </p>

        <div className="flex gap-6 mt-12">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 font-semibold transition" type="button">
            Discover Collection
          </button>
          <button className="border border-white hover:bg-white hover:text-black px-8 py-4 transition" type="button">
            Learn More
          </button>
        </div>
      </div>

      <div className="lg:w-1/2 flex justify-end pl-24 lg:pl-32 mt-16 lg:mt-0">
        <Image
          src="/images/Hero-model.png"
          alt="Luxury Fashion Model"
          width={700}
          height={900}
          className="w-full max-w-xl object-cover"
        />
      </div>
    </section>
  );
}
