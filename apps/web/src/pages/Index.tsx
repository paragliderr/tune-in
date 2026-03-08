import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MovieGrid from "@/components/MovieGrid";
import FeaturesSection from "@/components/FeaturesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import InteractiveBackground from "@/components/InteractiveBackground";
import { useLenis } from "@/hooks/useLenis";
import { SmoothCursor } from "../components/ui/smooth-cursor";

const Index = () => {
  useLenis();

  return (
    <div className="min-h-screen bg-background custom-cursor-scope">
      <SmoothCursor />

      {/* <InteractiveBackground /> */}
      <Navbar />
      <HeroSection />
      <MovieGrid />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
