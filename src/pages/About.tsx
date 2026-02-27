import { motion } from "framer-motion";
import { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLenis } from "@/hooks/useLenis";
import { Palette, Brain, Database } from "lucide-react";

const founders = [
  {
    name: "Ayush Tiwari",
    role: "Frontend & UI/UX",
    description: "Designs the frontend and crafts every pixel of the user experience. Ayush ensures TUNE-IN feels premium, intuitive, and visually stunning.",
    icon: Palette,
  },
  {
    name: "Vardhak Sharma",
    role: "Backend & AI",
    description: "Architects the backend infrastructure and builds the AI-powered features that make TUNE-IN smart and adaptive.",
    icon: Brain,
  },
  {
    name: "Samanyu Khanna",
    role: "APIs & Database",
    description: "Handles all API integrations and database architecture, ensuring TUNE-IN runs fast, reliably, and at scale.",
    icon: Database,
  },
];

const About = () => {
  useLenis();

  return (
    <div className="min-h-screen bg-background">
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
              We're three builders who believe technology should bring people closer — not further apart. TUNE-IN is our answer to a more connected world.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {founders.map((founder, index) => {
              const cardRef = useRef<HTMLDivElement>(null);
              const [transform, setTransform] = useState("perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)");

              const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                const card = cardRef.current;
                if (!card) return;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -10;
                const rotateY = ((x - centerX) / centerX) * 10;
                setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`);
              };

              const handleMouseLeave = () => {
                setTransform("perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)");
              };

              return (
              <motion.div
                key={founder.name}
                ref={cardRef}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: index * 0.15 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ transform, transition: "transform 0.2s ease-out" }}
                className="group relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm text-center hover:border-primary/40 hover:shadow-[0_0_30px_hsl(263_70%_58%/0.15)] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                  <founder.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-1">{founder.name}</h3>
                <span className="text-primary text-sm font-medium tracking-wider uppercase">{founder.role}</span>
                <p className="mt-4 text-muted-foreground text-sm leading-relaxed">{founder.description}</p>
              </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
