import Image from "next/image";

export default function CollectionsPage() {
  return (
    <div className="min-h-screen bg-black text-white py-16 px-8">
      <h1 className="text-5xl font-bold text-center text-yellow-500 mb-12">
        Our Collections
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <Image
            src="/images/men.jpg"
            alt="Men Collection"
            width={400}
            height={500}
            className="w-full h-[450px] object-cover"
          />
          <div className="p-4">
            <h2 className="text-xl font-bold">Men Collection</h2>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <Image
            src="/images/women.jpg"
            alt="Women Collection"
            width={400}
            height={500}
            className="w-full h-[450px] object-cover"
          />
          <div className="p-4">
            <h2 className="text-xl font-bold">Women Collection</h2>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <Image
            src="/images/children.jpg"
            alt="Children Collection"
            width={400}
            height={500}
            className="w-full h-[450px] object-cover"
          />
          <div className="p-4">
            <h2 className="text-xl font-bold">Children Collection</h2>
          </div>
        </div>

      </div>
    </div>
  );
}