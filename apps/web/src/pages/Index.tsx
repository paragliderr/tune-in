import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
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
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.onboarding_completed) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    };

    check();
  }, []);

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
