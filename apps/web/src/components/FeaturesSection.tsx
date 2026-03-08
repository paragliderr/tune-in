import { motion } from "framer-motion";
import { MagicCard } from "@/components/ui/magic-card";
import { AuroraText } from "@/components/ui/aurora-text";
import { WordRotate } from "@/components/ui/word-rotate";
import { Users, MessageCircle, Compass, Sparkles } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Connect with People",
    description:
      "Find like-minded individuals who share your passions. Build real connections around activities you love.",
  },
  {
    icon: MessageCircle,
    title: "Share & Discuss",
    description:
      "Talk about your latest hobbies, daily routines, and discoveries. Every conversation sparks something new.",
  },
  {
    icon: Compass,
    title: "Discover Activities",
    description:
      "Explore trending hobbies and activities from your community. Get inspired to try something different.",
  },
  {
    icon: Sparkles,
    title: "Track Your Journey",
    description:
      "Log what you're doing, set goals, and watch your activity timeline grow over time.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative z-20 py-32 px-4 md:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight font-display leading-[1.05]">
            <span className="text-foreground">Your life, </span>
            <AuroraText
              speed={2}
              className="ml-2 font-bold tracking-tight"
              colors={["#9E7AFF", "#7928CA", "#0070F3", "#38bdf8"]}
            >
              amplified.
            </AuroraText>
          </h2>

          <div className="mt-6 flex flex-col items-center text-muted-foreground text-lg md:text-xl">
            <div className="flex items-center justify-center">
              <span>
                TUNE-IN is where people &nbsp;
              </span>

              <span className="relative inline-block w-[26ch] text-left">
                <WordRotate
                  words={[
                    "share what they’re doing",
                    "discover new hobbies",
                    "build meaningful connections",
                  ]}
                  duration={2500}
                  className="font-semibold text-foreground whitespace-nowrap"
                />
              </span>
            </div>

            <span className="mt-2">— all in one place.</span>
          </div>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <MagicCard
                key={feature.title}
                className="p-[1px] rounded-2xl"
                gradientSize={300}
                gradientColor="rgba(255,255,255,0.35)"
                gradientOpacity={0.8}
                gradientFrom="hsl(263 70% 58%)"
                gradientTo="hsl(263 70% 70%)"
              >
                <div className="group relative p-8 rounded-2xl bg-card/80 backdrop-blur-sm cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-primary/20">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </MagicCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
