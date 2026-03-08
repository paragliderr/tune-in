import { motion } from "framer-motion";
import { MagicCard } from "@/components/ui/magic-card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLenis } from "@/hooks/useLenis";
import { Palette, Brain, Database } from "lucide-react";
import { SmoothCursor } from "../components/ui/smooth-cursor";

const founders = [
  {
    name: "Ayush Tiwari",
    role: "Frontend & UI/UX",
    description:
      "Designs the frontend and crafts every pixel of the user experience, so that TUNE-IN feels premium, intuitive, and visually stunning.",
    icon: Palette,
  },
  {
    name: "Vardhak Sharma",
    role: "Backend & AI",
    description:
      "Architects the backend infrastructure and builds the AI-powered features that make TUNE-IN smart and adaptive.",
    icon: Brain,
  },
  {
    name: "Samanyu Khanna",
    role: "APIs & Database",
    description:
      "Handles all API integrations and database architecture, ensuring TUNE-IN runs fast, reliably, and at scale.",
    icon: Database,
  },
];

const About = () => {
  useLenis();

  return (
    <div className="min-h-screen bg-background custom-cursor-scope">
      <SmoothCursor />
      <Navbar />

      <section className="pt-32 pb-20 px-4 md:px-12">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-foreground font-display tracking-wide">
              About Us
            </h1>
            <p className="mt-6 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              We're three builders who believe technology should bring people
              closer — not further apart. TUNE-IN is our answer to a more
              connected world.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {founders.map((founder, index) => (
              <motion.div
                key={founder.name}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.15 }}
              >
                <MagicCard
                  className="p-[1px] rounded-2xl"
                  gradientSize={300}
                  gradientColor="rgba(255,255,255,0.35)"
                  gradientOpacity={0.8}
                  gradientFrom="hsl(263 70% 58%)"
                  gradientTo="hsl(263 70% 70%)"
                >
                  <div className="group relative p-8 rounded-2xl bg-card/50 backdrop-blur-sm text-center cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 transition-colors duration-300 group-hover:bg-primary/20">
                      <founder.icon className="w-8 h-8 text-primary" />
                    </div>

                    <h3 className="text-xl font-semibold text-foreground mb-1">
                      {founder.name}
                    </h3>

                    <span className="text-primary text-sm font-medium tracking-wider uppercase">
                      {founder.role}
                    </span>

                    <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                      {founder.description}
                    </p>
                  </div>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
