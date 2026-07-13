import Image from "next/image";

const categories = [
  { title: "MEN", subtitle: "Sophisticated styles for the modern gentleman.", image: "/men.jpg" },
  { title: "WOMEN", subtitle: "Elegant fashion for every occasion.", image: "/women.jpg" },
  { title: "CHILDREN", subtitle: "Premium fashion for little trendsetters.", image: "/children.jpg" },
];

export function CategoryGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 mt-20 gap-6 px-6 lg:px-10 pb-24">
      {categories.map((category) => (
        <div key={category.title} className="relative h-[420px] bg-neutral-900 overflow-hidden rounded-3xl">
          <Image
            src={category.image}
            alt={`${category.title} Collection`}
            fill
            className="object-cover hover:scale-105 transition duration-700"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-8">
            <h2 className="text-4xl font-bold text-white">{category.title}</h2>
            <p className="text-gray-300 mt-2">{category.subtitle}</p>
            <button className="mt-6 text-yellow-400 font-semibold hover:text-yellow-300" type="button">
              Shop {category.title} →
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
