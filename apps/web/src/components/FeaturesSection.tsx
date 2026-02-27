import { motion } from "framer-motion";
import { Users, MessageCircle, Compass, Sparkles } from "lucide-react";
import { useState, useRef } from "react";

const features = [
  {
    icon: Users,
    title: "Connect with People",
    description: "Find like-minded individuals who share your passions. Build real connections around activities you love.",
  },
  {
    icon: MessageCircle,
    title: "Share & Discuss",
    description: "Talk about your latest hobbies, daily routines, and discoveries. Every conversation sparks something new.",
  },
  {
    icon: Compass,
    title: "Discover Activities",
    description: "Explore trending hobbies and activities from your community. Get inspired to try something different.",
  },
  {
    icon: Sparkles,
    title: "Track Your Journey",
    description: "Log what you're doing, set goals, and watch your activity timeline grow over time.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative z-20 py-32 px-4 md:px-12">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-foreground font-display tracking-wide">
            Your life, amplified.
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            TUNE-IN is where people share what they're doing, discover new hobbies, and build meaningful connections — all in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
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
              const rotateX = ((y - centerY) / centerY) * -8;
              const rotateY = ((x - centerX) / centerX) * 8;
              setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04)`);
            };

            const handleMouseLeave = () => {
              setTransform("perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)");
            };

            return (
            <motion.div
              key={feature.title}
              ref={cardRef}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ transform, transition: "transform 0.2s ease-out" }}
              className="group relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_0_30px_hsl(263_70%_58%/0.15)] cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
