import { CategoryGrid } from "@/components/CategoryGrid";
import { HeroSection } from "@/components/HeroSection";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Navigation />
      <HeroSection />
      <CategoryGrid />
    </main>
  );
}
